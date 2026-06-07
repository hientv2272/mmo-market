using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using MmoMarket.Application.Common;

namespace MmoMarket.Infrastructure.Security;

/// <summary>
/// Mã hóa AES-256-GCM (xác thực) cho payload bàn giao. Khóa lấy từ config "Encryption:Key"
/// (base64 32 byte hoặc passphrase → SHA-256). Có dev fallback nếu chưa cấu hình.
/// Ciphertext có tiền tố "enc:"; chuỗi không có tiền tố được coi là plaintext cũ (tương thích ngược).
/// </summary>
public class AesEncryptionService : IEncryptionService
{
    private const string Prefix = "enc:";
    private readonly byte[] _key; // 32 bytes

    public AesEncryptionService(IConfiguration config)
    {
        var configured = config["Encryption:Key"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            try
            {
                var b = Convert.FromBase64String(configured);
                _key = b.Length == 32 ? b : SHA256.HashData(Encoding.UTF8.GetBytes(configured));
            }
            catch { _key = SHA256.HashData(Encoding.UTF8.GetBytes(configured)); }
        }
        else
        {
            // Dev fallback — KHÔNG dùng cho production. Đặt Encryption:Key trong appsettings/biến môi trường.
            _key = SHA256.HashData(Encoding.UTF8.GetBytes("mmo-market-dev-encryption-key-change-me"));
        }
    }

    public string Encrypt(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext;
        var nonce = RandomNumberGenerator.GetBytes(12);
        var plain = Encoding.UTF8.GetBytes(plaintext);
        var cipher = new byte[plain.Length];
        var tag = new byte[16];
        using var aes = new AesGcm(_key, 16);
        aes.Encrypt(nonce, plain, cipher, tag);
        var output = new byte[12 + 16 + cipher.Length]; // nonce | tag | cipher
        Buffer.BlockCopy(nonce, 0, output, 0, 12);
        Buffer.BlockCopy(tag, 0, output, 12, 16);
        Buffer.BlockCopy(cipher, 0, output, 28, cipher.Length);
        return Prefix + Convert.ToBase64String(output);
    }

    public string Decrypt(string ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext) || !ciphertext.StartsWith(Prefix, StringComparison.Ordinal))
            return ciphertext; // plaintext cũ
        var data = Convert.FromBase64String(ciphertext[Prefix.Length..]);
        var nonce = data.AsSpan(0, 12);
        var tag = data.AsSpan(12, 16);
        var cipher = data.AsSpan(28);
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(_key, 16);
        aes.Decrypt(nonce, cipher, tag, plain);
        return Encoding.UTF8.GetString(plain);
    }
}
