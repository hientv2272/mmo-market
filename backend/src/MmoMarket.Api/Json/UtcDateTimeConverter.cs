using System.Text.Json;
using System.Text.Json.Serialization;

namespace MmoMarket.Api.Json;

// DateTime trong DB được lưu là UTC (DateTime.UtcNow) nhưng khi EF/SQLite đọc lên
// Kind = Unspecified, khiến System.Text.Json serialize KHÔNG kèm hậu tố 'Z'.
// Client (UTC+7) sẽ parse nhầm thành giờ local -> lệch 7 tiếng.
// Converter này luôn phát ISO-8601 dạng UTC (có 'Z') mà không dịch chuyển giá trị.
public class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
    {
        var utc = value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc), // Unspecified: đã là UTC, chỉ gắn nhãn
        };
        writer.WriteStringValue(utc.ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ"));
    }
}

public class UtcNullableDateTimeConverter : JsonConverter<DateTime?>
{
    private readonly UtcDateTimeConverter _inner = new();

    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : _inner.Read(ref reader, typeof(DateTime), options);

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else _inner.Write(writer, value.Value, options);
    }
}
