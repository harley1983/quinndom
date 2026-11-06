# QuinnDom

My city-building game that I practice my vibecoding. A daily puzzle game that grows one small floating city.

Live: https://harley1983.github.io/quinndom

## How it is built
Plain HTML, CSS and JavaScript. No build step, no server. Open `index.html` in a browser to run it.

```
index.html          page shell
css/tokens.css      palette v4 colours, pixel UI tokens, fonts
css/ui.css          buttons, inputs, switches, slider, toast
css/screens.css     welcome, home and settings layouts
js/save.js          save in localStorage + export/import of a JSON save file
js/sound.js         sound engine (Web Audio, no audio files)
js/art.js           pixel art drawn in code (brain logo, island, secrets)
js/screens.js       screens and screen switching
js/main.js          start-up
```

## Decisions
- One save per browser (key `quinndom.save.v1`). Export a save file now and then.
- Sound is off by default. Separate switches for effects and ambience, one volume slider. Spec: the palette doc in the QuinnDom Project.
- Same content every day for everyone (picked from the date, Vietnam time).
- Logo: the pixel growing brain.

## Using sound from game code
```js
Sound.play('stamp');            // plays only if effects are on
Sound.startAmbience('garden');  // call when a puzzle opens (garden, rain, night)
Sound.stopAmbience();           // call when it ends (fades out)
```
Moment names: tap, collect, correct, notquite, stamp, solved, milestone, bossin, bosshit, bossend.
