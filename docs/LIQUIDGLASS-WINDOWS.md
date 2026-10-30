# Windows LiquidGlass integration

The Windows HUD now has a package-backed qualification host under
`server/liquidglass-host`. It references the published `LiquidGlass` 1.0.0
NuGet package and renders through its `GlassPainter` API. The host is built with
the .NET 10 SDK and is intentionally separate from the safety-critical
.NET Framework AxonHost until the IPC and packaging boundary is qualified.

The current portable bundle still uses the in-box compatibility renderer. Do
not describe it as direct NuGet integration. The next integration step is to
publish this helper as a signed, architecture-matched companion and connect it
to the existing layered HUD over a persistent local IPC channel. The updater
must replace the helper and skill as one bundle and refuse a missing or
incompatible helper.

Qualification command (requires a .NET 10 SDK):

```powershell
dotnet build server/liquidglass-host/LiquidGlass.Host.csproj -c Release
dotnet run --project server/liquidglass-host/LiquidGlass.Host.csproj -c Release -- .localdata/liquidglass-real.png
```

This test proves the published package can be loaded and render a caller-owned
surface. It does not yet prove the production HUD IPC or release packaging.
