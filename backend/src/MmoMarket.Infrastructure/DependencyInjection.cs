using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MmoMarket.Application.Common;
using MmoMarket.Infrastructure.Auth;
using MmoMarket.Infrastructure.Persistence;

namespace MmoMarket.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        var connectionString = config.GetConnectionString("Default") ?? "Data Source=mmo-market.db";
        services.AddDbContext<AppDbContext>(opt => opt.UseSqlite(connectionString));
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.Configure<JwtOptions>(config.GetSection("Jwt"));
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IEncryptionService, Security.AesEncryptionService>();
        services.AddSingleton<IEmailSender, Email.SmtpEmailSender>();
        return services;
    }
}
