using LiquidGlass.Skia;
using SkiaSharp;

if (args.Length < 1) throw new ArgumentException("output PNG path is required");
var output = Path.GetFullPath(args[0]);
var width = args.Length > 1 && int.TryParse(args[1], out var parsedWidth) ? parsedWidth : 940;
var height = args.Length > 2 && int.TryParse(args[2], out var parsedHeight) ? parsedHeight : 104;
var state = args.Length > 3 ? args[3] : "active";
Directory.CreateDirectory(Path.GetDirectoryName(output)!);

using var surface = SKSurface.Create(new SKImageInfo(width, height, SKColorType.Bgra8888, SKAlphaType.Premul));
var canvas = surface.Canvas;
canvas.Clear(new SKColor(7, 10, 18, 255));
var painter = new GlassPainter();
painter.RecordBackdrop(width, height, c => {
    c.Clear(new SKColor(7, 10, 18, 255));
    using var backdrop = new SKPaint { Color = new SKColor(22, 28, 42, 255) };
    c.DrawRoundRect(new SKRect(30, 22, width - 30, height - 22), 42, 42, backdrop);
}, new SKColor(7, 10, 18, 255));

var options = new GlassSurfaceOptions(
    Dark: true, TintAmount: 0f, Density: 1f, Materialize: 1f,
    ReducedTransparency: 0f, IncreasedContrast: 0f, LightX: 0f, LightY: -1f);
var bar = new SKRect(30, 22, width - 30, height - 22);
painter.DrawSurface(canvas, bar, state == "stopped" ? 0.88f : 0.72f, options);
using var image = surface.Snapshot();
using var data = image.Encode(SKEncodedImageFormat.Png, 100);
using var stream = File.Create(output);
data.SaveTo(stream);
