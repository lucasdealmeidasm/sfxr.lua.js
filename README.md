sfxr.lua.js
===========

A port of the sfxr sound effect synthesizer to pure Javascript, designed to be used
in HTML5 games.


Example usage
-------------

These examples should play a randomly generated sound.

```javascript
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = new AudioContext();
var sound = new sfxr.Sound();
sound.randomExplosion();
sound.play(sfxr.FREQ_44100, audioCtx);
```


**More documentation will be available at the [Project Wiki](https://github.com/lucasdealmeidasm/sfxr.lua.js/wiki)**
