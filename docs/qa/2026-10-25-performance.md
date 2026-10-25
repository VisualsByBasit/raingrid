# Performance pass (J1), 25 October 2026

A judge reported lag on phones and integrated GPUs. This pass lowers the cost of the hero and the map, then measures before and after.

## Changes

- **Hero canvas:** 1 device pixel per CSS pixel on phones (low tier), at most 1.5 elsewhere (was up to 1.75). `frameloop="demand"` with a driver that invalidates every frame only while the hero is on screen and the tab is visible, about 8 fps while the loader still covers it, and never otherwise.
- **Hero effects:** phones skip bloom and SMAA; vignette and grain stay (one merged pass). Rain is one instanced draw; there are no dynamic shadows; the droplet's four splash drops are plain meshes.
- **Droplet:** the phone transmission buffer starts at 256 px and rises to 512 px only while the device holds 50 fps (drei `PerformanceMonitor`), falling back to 256 if it slows.
- **Map:** MapLibre `pixelRatio` capped at 1.5 on phones and touch devices (was 2).
- **Rain canvas:** stops its animation loop when nothing is raining and restarts on the next replay; phones and tablets draw at 30 fps. Phones no longer run the light idle drizzle between replays.

## Method

Production build (`next start`), Chrome 127 driven by puppeteer-core in a real off-screen window, 390 × 844 viewport at device scale 3 (phone emulation, so the low tier is active), **4x CPU throttle**. Each scene is measured for 8 s (replay: 3.8 s, the storm's length), two runs each, averaged.

- **ms per frame**: main-thread task time divided by frames drawn. Lower is better, and it is the number that decides whether a slow phone holds 60 fps (16.7 ms budget) or 30 fps.
- **Canvas Mpx**: total backing-store pixels of every canvas on screen, a proxy for GPU fill cost.
- Frame rates are not quoted as phone fps: the workstation display runs at 240 Hz and its GPU is not throttled, so uncapped fps here overstates a phone.

## Results

| Scene | Metric | Before | After | Change |
| --- | --- | ---: | ---: | ---: |
| Landing hero | ms per frame | 8.7 | 6.8 | -22% |
| Landing hero | canvas Mpx | 3.06 | 1.81 | -41% |
| Map, idle | ms per frame | 1.0 | 0.35 | -65% |
| Map, idle | main thread busy | 24% | 8% | -16 points |
| Map, storm replay | ms per frame | 4.0 | 2.3 | -43% |
| Map (both) | canvas Mpx | 2.06 | 1.48 | -28% |

No long tasks (over 50 ms) were recorded in any run, before or after.

Raw frame rates from the same runs (average of two). The ceiling is the workstation's 240 Hz display, not 60 Hz, so they show the direction, not what a phone gets:

| Scene | fps before | fps after | Long tasks before / after |
| --- | ---: | ---: | ---: |
| Landing hero | 112.7 | 144.8 | 0 / 0 |
| Map, idle | 238.8 | 240 (capped) | 0 / 0 |
| Map, storm replay | 213.7 | 221.9 | 0 / 0 |

The hero's GPU saving is larger than the CPU numbers show: on phones its canvas drops from 1.75x to 1x (about 3x fewer pixels to shade) and bloom's blur chain is gone. CPU throttling does not slow the GPU, so a check on a real mid-range phone remains a release-owner action.
