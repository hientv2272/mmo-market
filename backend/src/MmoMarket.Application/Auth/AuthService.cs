using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MmoMarket.Application.Common;
using MmoMarket.Application.Config;
using MmoMarket.Domain.Entities;
using MmoMarket.Domain.Enums;

namespace MmoMarket.Application.Auth;

public class AuthService
{
    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;
    private readonly ConfigService _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly TotpService _totp;
    private readonly string _googleClientId;

    public AuthService(IAppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt,
        ConfigService config, IHttpClientFactory httpFactory, IConfiguration configuration,
        TotpService totp)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
        _config = config;
        _httpFactory = httpFactory;
        _totp = totp;
        _googleClientId = configuration["Google:ClientId"] ?? "";
    }

    public async Task<AuthResponse> RegisterAsync(RegisterDto dto, CancellationToken ct)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            throw new AppException("Email đã tồn tại");
        if (await _db.Users.AnyAsync(u => u.Username == dto.Username, ct))
            throw new AppException("Username đã tồn tại");

        var signupBonus  = await _config.GetIntAsync(ConfigKeys.LoyaltySignupBonus, 100, ct);
        var welcomeBonus = await _config.GetDecimalAsync(ConfigKeys.WelcomeBonus, 100_000m, ct);
        var user = new User
        {
            Email = email,
            PasswordHash = _hasher.Hash(dto.Password),
            Username = dto.Username,
            DisplayName = dto.DisplayName,
            Role = UserRole.Buyer,
            ReferralCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
            WalletBalance = welcomeBonus,
            LoyaltyPoints = signupBonus,
        };

        if (!string.IsNullOrWhiteSpace(dto.ReferralCode))
        {
            var refUser = await _db.Users.FirstOrDefaultAsync(u => u.ReferralCode == dto.ReferralCode, ct);
            if (refUser != null)
            {
                user.ReferredByUserId = refUser.Id;
            }
        }

        _db.Users.Add(user);
        _db.WalletTxns.Add(new WalletTxn
        {
            UserId = user.Id,
            Type = WalletTxnType.Bonus,
            Amount = welcomeBonus,
            Status = WalletTxnStatus.Completed,
            Note = "Quà chào mừng",
        });
        await _db.SaveChangesAsync(ct);

        return new AuthResponse(_jwt.GenerateAccessToken(user), Map(user));
    }

    public async Task<AuthResponse> LoginAsync(LoginDto dto, CancellationToken ct)
    {
        var email = dto.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct)
            ?? throw new AppException("Sai email hoặc mật khẩu", 401);
        if (string.IsNullOrEmpty(user.PasswordHash) || !_hasher.Verify(dto.Password, user.PasswordHash))
            throw new AppException("Sai email hoặc mật khẩu", 401);
        return new AuthResponse(_jwt.GenerateAccessToken(user), Map(user));
    }

    public async Task<AuthResponse> GoogleLoginAsync(string idToken, CancellationToken ct)
    {
        var http = _httpFactory.CreateClient();
        GoogleTokenInfo info;
        try
        {
            var response = await http.GetAsync(
                $"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}", ct);
            if (!response.IsSuccessStatusCode)
                throw new AppException("Token Google không hợp lệ", 401);
            info = await response.Content.ReadFromJsonAsync<GoogleTokenInfo>(ct)
                   ?? throw new AppException("Token Google không hợp lệ", 401);
        }
        catch (AppException) { throw; }
        catch (HttpRequestException)
        {
            throw new AppException("Không thể kết nối đến Google để xác minh", 502);
        }

        if (!string.IsNullOrEmpty(_googleClientId) && info.Aud != _googleClientId)
            throw new AppException("Token Google không hợp lệ", 401);

        if (info.EmailVerified != "true")
            throw new AppException("Email Google chưa được xác minh");

        var email = info.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(
            u => u.GoogleId == info.Sub || u.Email == email, ct);

        if (user == null)
        {
            var baseName = Regex.Replace(email.Split('@')[0], @"[^a-zA-Z0-9_]", "");
            if (baseName.Length < 3) baseName = "user" + baseName;
            var username = baseName;
            if (await _db.Users.AnyAsync(u => u.Username == username, ct))
                username = baseName + "_" + Guid.NewGuid().ToString("N")[..6];

            var signupBonus  = await _config.GetIntAsync(ConfigKeys.LoyaltySignupBonus, 100, ct);
            var welcomeBonus = await _config.GetDecimalAsync(ConfigKeys.WelcomeBonus, 100_000m, ct);

            user = new User
            {
                Email        = email,
                GoogleId     = info.Sub,
                PasswordHash = Guid.NewGuid().ToString("N"), // unusable — Google-only account
                Username     = username,
                DisplayName  = string.IsNullOrWhiteSpace(info.Name) ? username : info.Name,
                Role         = UserRole.Buyer,
                ReferralCode = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant(),
                WalletBalance = welcomeBonus,
                LoyaltyPoints = signupBonus,
            };
            _db.Users.Add(user);
            _db.WalletTxns.Add(new WalletTxn
            {
                UserId = user.Id,
                Type   = WalletTxnType.Bonus,
                Amount = welcomeBonus,
                Status = WalletTxnStatus.Completed,
                Note   = "Quà chào mừng",
            });
        }
        else if (user.GoogleId == null)
        {
            user.GoogleId = info.Sub; // link existing email account to Google
        }

        await _db.SaveChangesAsync(ct);
        return new AuthResponse(_jwt.GenerateAccessToken(user), Map(user));
    }

    public async Task<UserDto> MeAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        return Map(user);
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileDto dto, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (string.IsNullOrWhiteSpace(dto.DisplayName))
            throw new AppException("Tên hiển thị không được để trống");
        user.DisplayName = dto.DisplayName.Trim();
        user.AvatarColor = dto.AvatarColor;
        user.PhoneNumber = string.IsNullOrWhiteSpace(dto.PhoneNumber) ? null : dto.PhoneNumber.Trim();
        await _db.SaveChangesAsync(ct);
        return Map(user);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordDto dto, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (!_hasher.Verify(dto.CurrentPassword, user.PasswordHash))
            throw new AppException("Mật khẩu hiện tại không đúng");
        if (dto.NewPassword.Length < 6)
            throw new AppException("Mật khẩu mới phải có ít nhất 6 ký tự");
        user.PasswordHash = _hasher.Hash(dto.NewPassword);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<TwoFaSetupResult> Setup2FaAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (user.TwoFactorEnabled)
            throw new AppException("Bảo mật 2 lớp đã được bật. Hãy tắt trước khi thiết lập lại.");
        var result = _totp.GenerateSetup(user.Email);
        user.TotpSecret = result.Secret;
        await _db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<UserDto> Enable2FaAsync(Guid userId, string code, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (user.TwoFactorEnabled)
            throw new AppException("Bảo mật 2 lớp đã được bật.");
        if (string.IsNullOrEmpty(user.TotpSecret))
            throw new AppException("Chưa khởi tạo cài đặt 2FA. Vui lòng gọi setup trước.");
        if (!_totp.Verify(user.TotpSecret, code))
            throw new AppException("Mã xác thực không đúng hoặc đã hết hạn.");
        user.TwoFactorEnabled = true;
        await _db.SaveChangesAsync(ct);
        return Map(user);
    }

    public async Task<UserDto> Disable2FaAsync(Guid userId, string code, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new AppException("User không tồn tại", 404);
        if (!user.TwoFactorEnabled)
            throw new AppException("Bảo mật 2 lớp chưa được bật.");
        if (!_totp.Verify(user.TotpSecret!, code))
            throw new AppException("Mã xác thực không đúng hoặc đã hết hạn.");
        user.TwoFactorEnabled = false;
        user.TotpSecret = null;
        await _db.SaveChangesAsync(ct);
        return Map(user);
    }

    public static UserDto Map(User u) => new(
        u.Id, u.Email, u.Username, u.DisplayName, u.Role.ToString(),
        u.WalletBalance, u.LoyaltyPoints, u.KycStatus.ToString(), u.AvatarColor, u.PhoneNumber,
        u.TwoFactorEnabled);

    private sealed class GoogleTokenInfo
    {
        [JsonPropertyName("sub")]            public string Sub            { get; set; } = "";
        [JsonPropertyName("email")]          public string Email          { get; set; } = "";
        [JsonPropertyName("name")]           public string Name           { get; set; } = "";
        [JsonPropertyName("aud")]            public string Aud            { get; set; } = "";
        [JsonPropertyName("email_verified")] public string EmailVerified  { get; set; } = "";
    }
}
