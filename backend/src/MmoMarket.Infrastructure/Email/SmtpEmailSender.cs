using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MmoMarket.Application.Common;

namespace MmoMarket.Infrastructure.Email;

/// <summary>
/// Gửi email qua SMTP (System.Net.Mail). Nếu "Email:Enabled" != true hoặc thiếu host,
/// chỉ ghi log (no-op) để dev chạy được không cần SMTP thật.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<SmtpEmailSender> _log;
    public SmtpEmailSender(IConfiguration cfg, ILogger<SmtpEmailSender> log) { _cfg = cfg; _log = log; }

    public async Task SendAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var enabled = bool.TryParse(_cfg["Email:Enabled"], out var e) && e;
        var host = _cfg["Email:Host"];
        if (!enabled || string.IsNullOrWhiteSpace(host))
        {
            _log.LogInformation("[Email:noop] To={To} | Subject={Subject} (SMTP chưa bật)", toEmail, subject);
            return;
        }

        var port = int.TryParse(_cfg["Email:Port"], out var p) ? p : 587;
        var from = _cfg["Email:From"] ?? "no-reply@mmomarket.local";
        var fromName = _cfg["Email:FromName"] ?? "MMO Market";
        var user = _cfg["Email:User"];
        var pass = _cfg["Email:Password"];
        var useSsl = !bool.TryParse(_cfg["Email:UseSsl"], out var s) || s; // mặc định true

        using var msg = new MailMessage
        {
            From = new MailAddress(from, fromName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true,
        };
        msg.To.Add(toEmail);

        using var client = new SmtpClient(host, port) { EnableSsl = useSsl };
        if (!string.IsNullOrWhiteSpace(user))
            client.Credentials = new NetworkCredential(user, pass);

        await client.SendMailAsync(msg, ct);
        _log.LogInformation("[Email] đã gửi tới {To} | {Subject}", toEmail, subject);
    }
}
