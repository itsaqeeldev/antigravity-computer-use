// Adapted from shayann07/liquidglass, ports/dotnet/LiquidGlass.Skia/GlassPainter.cs.
// Source revision: 7f3c7d9 (Apache-2.0). This adapter keeps the safety-critical
// Windows HUD on the in-box GDI+ renderer: it never captures foreign windows or
// desktop pixels. The published Skia/WinForms packages remain the visual source
// of truth for the material profile.
using System;
using System.Drawing;
using System.Drawing.Drawing2D;

namespace Axon {
    internal static class LiquidGlassMaterial {
        // The dark opacity curve is the published LiquidGlass profile. Keeping
        // the curve here makes the native HUD use the same measured material
        // values without adding a second runtime to the portable bundle.
        static readonly float[,] DarkOpacity = new float[,] {
            { 0f, .416f }, { 29f, .439f }, { 50f, .451f },
            { 62f, .510f }, { 86f, .655f }, { 100f, .737f }
        };

        internal static float Opacity(float tintPercent) {
            float x = Math.Max(0, Math.Min(100, tintPercent));
            int i = 0;
            while (i < DarkOpacity.GetLength(0) - 2 && DarkOpacity[i + 1, 0] <= x) i++;
            float xa = DarkOpacity[i, 0], ya = DarkOpacity[i, 1];
            float xb = DarkOpacity[i + 1, 0], yb = DarkOpacity[i + 1, 1];
            return ya + (yb - ya) * (x - xa) / (xb - xa);
        }

        internal static void DrawSurface(Graphics g, GraphicsPath shape, RectangleF bounds,
            Color accent, float breath, float density) {
            float tint = Opacity(50) * 255f;
            int lift = 35;
            int baseAlpha = (int)Math.Max(120, Math.Min(232, tint + 82));
            Color top = Blend(Color.FromArgb(baseAlpha, 55, 66, 82), accent, .16f);
            Color bottom = Blend(Color.FromArgb(Math.Max(112, baseAlpha - 58), 7, 11, 19), accent, .08f);
            using (LinearGradientBrush bg = new LinearGradientBrush(bounds, top, bottom, 90f)) {
                bg.InterpolationColors = new ColorBlend {
                    Colors = new[] { top, Blend(top, bottom, .45f), bottom },
                    Positions = new[] { 0f, .45f, 1f }
                };
                g.FillPath(bg, shape);
            }

            // A narrow clear band is the useful part of the LiquidGlass profile
            // on a small HUD: it gives the surface depth without pretending to
            // have a screenshot of the foreign desktop behind it.
            using (GraphicsPath clip = (GraphicsPath)shape.Clone()) {
                g.SetClip(clip);
                using (LinearGradientBrush band = new LinearGradientBrush(
                    new RectangleF(bounds.X, bounds.Y + 3, bounds.Width, Math.Max(8, bounds.Height * .28f)),
                    Color.FromArgb((int)(42 * breath), 248, 252, 255),
                    Color.FromArgb(0, 248, 252, 255), 90f))
                    g.FillRectangle(band, bounds.X, bounds.Y, bounds.Width, bounds.Height * .34f);

                using (GraphicsPath sheen = new GraphicsPath()) {
                    sheen.AddEllipse(bounds.X - bounds.Width * .28f, bounds.Y - bounds.Height * 1.12f,
                        bounds.Width * .78f, bounds.Height * 2.1f);
                    using (PathGradientBrush light = new PathGradientBrush(sheen)) {
                        light.CenterColor = Color.FromArgb((int)(32 * breath), 238, 248, 255);
                        light.SurroundColors = new[] { Color.Transparent };
                        g.FillPath(light, sheen);
                    }
                }
                g.ResetClip();
            }

            // Bevel values mirror the published material's lift and edge light.
            using (Pen topRim = new Pen(Color.FromArgb((int)(92 * breath), 220, 237, 248), 1f))
            using (Pen bottomRim = new Pen(Color.FromArgb(76, 4, 8, 15), 1f)) {
                topRim.Alignment = PenAlignment.Inset;
                bottomRim.Alignment = PenAlignment.Inset;
                g.DrawPath(topRim, shape);
                RectangleF lower = new RectangleF(bounds.X, bounds.Y + 1, bounds.Width, bounds.Height - 1);
                using (GraphicsPath lowerPath = Overlay.RoundRect(lower, Math.Max(1, bounds.Height / 2f - 1)))
                    g.DrawPath(bottomRim, lowerPath);
            }
            // Keep the profile's subtle lift visible on dark mode without
            // turning the bar into an opaque card.
            using (SolidBrush liftBrush = new SolidBrush(Color.FromArgb((int)(lift * .45f), 255, 255, 255))) {
                using (GraphicsPath liftPath = Overlay.RoundRect(new RectangleF(bounds.X + 2, bounds.Y + 2,
                    bounds.Width - 4, Math.Max(2, bounds.Height * .12f)), Math.Max(1, bounds.Height / 8f)))
                    g.FillPath(liftBrush, liftPath);
            }
        }

        static Color Blend(Color a, Color b, float amount) {
            float t = Math.Max(0, Math.Min(1, amount));
            return Color.FromArgb(a.A,
                (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t),
                (int)(a.B + (b.B - a.B) * t));
        }
    }
}
