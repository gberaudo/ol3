# POC of using webworkers and Offscreencanvas

## Goal

Investigate chrome offscreen rendering (1):
- Is current code runnable inside a worker
- What is the overhead introduced by main thread <> worker interaction


## Code (to run with chrome)

```bash
git clone https://github.com/gberaudo/openlayers -b webworker olvt_webworker_poc
cd olvt_webworker_poc
npm i
chromium-browser http://localhost:8080/mapbox-vector-tiles.html &
npm run serve-examples
```


## POC strategy and state

- An hardcoded MVT layer is instanciated in the worker;
- Rendering of the whole layer is simulated;
- 2 new canvases of the whole viewport are produced each frame;
- In worker: image bitmaps are extracted from offscreen canvases without copy (1);
- From worker to main thread: image bitmaps are transfered without copy (1);
- In main thread: image bitmaps are transfered (associated) into canvases without copy (1).

Important limitations:
- At the moment, only chromium-based browsers support 2D Offscreencanvas (chrome, chromium, Opera, Edge?) (3);


## Results

- Current code is runnable with small adaptations;
- There is almost no overhead when using Offscreencanvas.


## Further analysis

- Offscreen canvas looks really promising for rendering the base canvas;
- Easy to implement and to use conditionnaly;
- Web worker development is easy with a developer-oriented setup (live reload, sourcemap, ...);
- A new optimization Image.decoding exists to decode images outside of the main thread (2).


## Future steps

- Measure time currently spent in decoding pbf, building instructions, rendering instructions;
- Eventually, these measures could only be counted on out-of-budget frames;
- Rework the renderer to allow per-tile (source tile) interaction with the worker
  Main thread: do_tile_in_worker(xyz) ~~worker~> base canvas instructions or image bitmap + overlay canvas instructions
- Uncouple styles from image loading / preparation;
- Analyse use of Image.decoding optimization (2)


## Interesting resources

[1] https://www.youtube.com/watch?v=wkDd-x0EkFU
[2] https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding
[3] https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
