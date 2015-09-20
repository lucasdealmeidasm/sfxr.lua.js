/*
sfxr.lua
original by Tomas Pettersson,
ported to Lua by nucular,
ported to Javascript by Lucas de Almeida aka drnick
*/

/*
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

sfxr = (function() {

var sfxr = {};
//local bit = bit32 or require("bit");

// Constants

sfxr.VERSION = "0.0.1"

sfxr.SQUARE = 0;
sfxr.SAWTOOTH = 1;
sfxr.SINE = 2;
sfxr.NOISE = 3;

sfxr.FREQ_44100 = 44100;
sfxr.FREQ_22050 = 22050;
sfxr.BITS_FLOAT = 0;
sfxr.BITS_16 = 16;
sfxr.BITS_8 = 8;

// Utilities

// Simulates a C int cast
function trunc(n) {
	if (n >= 0) {
		return Math.floor(n);
	}
	else {
		return -Math.floor(-n);
	}
}

// Sets the random seed and initializes the generator
function setseed(seed) {
	//Math.randomseed(seed);
	for (var i=0; i<5; i++) {
		Math.random();
	}
}

// Returns a random number between low and high
function random(low, high) {
	return low + Math.random() * (high - low);
}

// Returns a random boolean weighted to false by n
function maybe(n) {
	return trunc(random(0, n ? n : 1)) == 0;
}

// Clamps n between min and max
function clamp(n, min, max) {
	return Math.max(min ? min : Number.NEGATIVE_INFINITY, Math.min(max ? max : Number.POSITIVE_INFINITY, n));
}

// Copies a table (shallow) or a primitive
function shallowcopy(t) {
	if (typeof t == "object") {
		var t2 = {};
		for (var k in t) {
			var v = t[k];
			t2[k] = v;
		}
		return t2;
	}
	else {
		return t;
	}
}

// Merges table t2 into t1
function mergetables(t1, t2) {
	for (var k in t2) {
		var v = t2[k];
		if (typeof v == "object") {
			if (typeof (t1[k] ? t1[k] : false) == "object") {
				mergetables(t1[k] ? t1[k] : {}, t2[k] ? t2[k] : {});
			}
			else {
				t1[k] = v;
			}
		}
		else {
			t1[k] = v;
		}
	}
	return t1;
}

// Packs a number into a IEEE754 32-bit big-endian floating point binary string
// source: https://stackoverflow.com/questions/14416734/
/*
local function packIEEE754(number)
	if number == 0 then
		return string.char(0x00, 0x00, 0x00, 0x00)
	elseif number ~= number then
		return string.char(0xFF, 0xFF, 0xFF, 0xFF)
	else
		local sign = 0x00
		if number < 0 then
			sign = 0x80
			number = -number
		end
		local mantissa, exponent = math.frexp(number)
		exponent = exponent + 0x7F
		if exponent <= 0 then
			mantissa = math.ldexp(mantissa, exponent - 1)
			exponent = 0
		elseif exponent > 0 then
			if exponent >= 0xFF then
				return string.char(sign + 0x7F, 0x80, 0x00, 0x00)
			elseif exponent == 1 then
				exponent = 0
			else
				mantissa = mantissa * 2 - 1
				exponent = exponent - 1
			end
		end
		mantissa = math.floor(math.ldexp(mantissa, 23) + 0.5)
		return string.char(
			sign + math.floor(exponent / 2),
			(exponent % 2) * 0x80 + math.floor(mantissa / 0x10000),
			math.floor(mantissa / 0x100) % 0x100,
			mantissa % 0x100)
	end
end
*/

// Unpacks a IEEE754 32-bit big-endian floating point string to a number
/*
local function unpackIEEE754(packed)
	local b1, b2, b3, b4 = string.byte(packed, 1, 4)
	local exponent = (b1 % 0x80) * 0x02 + math.floor(b2 / 0x80)
	local mantissa = math.ldexp(((b2 % 0x80) * 0x100 + b3) * 0x100 + b4, -23)
	if exponent == 0xFF then
		if mantissa > 0 then
			return 0 / 0
		else
			mantissa = math.huge
			exponent = 0x7F
		end
	elseif exponent > 0 then
		mantissa = mantissa + 1
	else
		exponent = exponent + 1
	end
	if b1 >= 0x80 then
		mantissa = -mantissa
	end
	return math.ldexp(mantissa, exponent - 0x7F)
end
*/

// Constructor
/*
function sfxr.newSound(...)
	local instance = setmetatable({}, sfxr.Sound)
	instance:__init(...)
	return instance
end
*/

// The main Sound class

sfxr.Sound = function() {
	this.volume = {};
	this.envelope = {};
	this.frequency = {};
	this.vibrato = {};
	this.change = {};
	this.duty = {};
	this.phaser = {};
	this.lowpass = {};
	this.highpass = {};

	// These won't be affected by Sound.resetParameters()
	this.supersamples = 8;
	this.volume.master = 0.5;
	this.volume.sound = 0.5;

	this.resetParameters();
}

//sfxr.Sound.__index = sfxr.Sound

/*
function sfxr.Sound:__init()
	-- Build tables to store the parameters in
	self.volume = {}
	self.envelope = {}
	self.frequency = {}
	self.vibrato = {}
	self.change = {}
	self.duty = {}
	self.phaser = {}
	self.lowpass = {}
	self.highpass = {}

	-- These won't be affected by Sound.resetParameters()
	self.supersamples = 8
	self.volume.master = 0.5
	self.volume.sound = 0.5

	self:resetParameters()
end
*/

sfxr.Sound.prototype.resetParameters = function () {
	// Set all parameters to the default values
	this.repeatspeed = 0.0;
	this.wavetype = sfxr.SQUARE;

	this.envelope.attack = 0.0;
	this.envelope.sustain = 0.3;
	this.envelope.punch = 0.0;
	this.envelope.decay = 0.4;

	this.frequency.start = 0.3;
	this.frequency.min = 0.0;
	this.frequency.slide = 0.0;
	this.frequency.dslide = 0.0;

	this.vibrato.depth = 0.0;
	this.vibrato.speed = 0.0;
	this.vibrato.delay = 0.0;

	this.change.amount = 0.0;
	this.change.speed = 0.0;
	
	this.duty.ratio = 0.0;
	this.duty.sweep = 0.0;

	this.phaser.offset = 0.0;
	this.phaser.sweep = 0.0;

	this.lowpass.cutoff = 1.0;
	this.lowpass.sweep = 0.0;
	this.lowpass.resonance = 0.0;
	this.highpass.cutoff = 0.0;
	this.highpass.sweep = 0.0;
}

sfxr.Sound.prototype.sanitizeParameters = function () {
	this.repeatspeed = clamp(this.repeatspeed, 0, 1);
	this.wavetype = clamp(this.wavetype, sfxr.SQUARE, sfxr.NOISE);

	this.envelope.attack = clamp(this.envelope.attack, 0, 1);
	this.envelope.sustain = clamp(this.envelope.sustain, 0, 1);
	this.envelope.punch = clamp(this.envelope.punch, 0, 1);
	this.envelope.decay = clamp(this.envelope.decay, 0, 1);
	
	this.frequency.start = clamp(this.frequency.start, 0, 1);
	this.frequency.min = clamp(this.frequency.min, 0, 1);
	this.frequency.slide = clamp(this.frequency.slide, -1, 1);
	this.frequency.dslide = clamp(this.frequency.dslide, -1, 1);

	this.vibrato.depth = clamp(this.vibrato.depth, 0, 1);
	this.vibrato.speed = clamp(this.vibrato.speed, 0, 1);
	this.vibrato.delay = clamp(this.vibrato.delay, 0, 1);
	
	this.change.amount = clamp(this.change.amount, -1, 1);
	this.change.speed = clamp(this.change.speed, 0, 1);
	
	this.duty.ratio = clamp(this.duty.ratio, 0, 1);
	this.duty.sweep = clamp(this.duty.sweep, -1, 1);

	this.phaser.offset = clamp(this.phaser.offset, -1, 1);
	this.phaser.sweep = clamp(this.phaser.sweep, -1, 1);

	this.lowpass.cutoff = clamp(this.lowpass.cutoff, 0, 1);
	this.lowpass.sweep = clamp(this.lowpass.sweep, -1, 1);
	this.lowpass.resonance = clamp(this.lowpass.resonance, 0, 1);
	this.highpass.cutoff = clamp(this.highpass.cutoff, 0, 1);
	this.highpass.sweep = clamp(this.highpass.sweep, -1, 1);
}

sfxr.Sound.prototype.generate = function (freq, bits) {
	// Basically the main synthesizing function, yields the sample data

	freq = freq ? freq : sfxr.FREQ_44100;
	bits = bits ? freq : sfxr.BITS_FLOAT;
	//assert(freq == sfxr.FREQ_44100 or freq == sfxr.FREQ_22050, "Invalid freq argument")
	//assert(bits == sfxr.BITS_FLOAT or bits == sfxr.BITS_16 or bits == sfxr.BITS_8, "Invalid bits argument")

	// Initialize ALL the locals!
	var fperiod, maxperiod;
	var slide, dslide;
	var square_duty, square_slide;
	var chg_mod, chg_time, chg_limit;

	var phaserbuffer = [];
	var noisebuffer = [];

	// Reset the sample buffers
	for (var i=0; i<1024; i++) {
		phaserbuffer[i] = 0;
	}

	for (var i=0; i<32; i++) {
		noisebuffer[i] = random(-1, 1);
	}
	
	//Hack
	var self = this;
	
	function reset() {
		fperiod = 100 / (Math.pow(self.frequency.start,2) + 0.001);
		maxperiod = 100 / (Math.pow(self.frequency.min,2) + 0.001);
		period = trunc(fperiod);

		slide = 1.0 - Math.pow(self.frequency.slide,3) * 0.01;
		dslide = -Math.pow(self.frequency.dslide,3) * 0.000001;

		square_duty = 0.5 - self.duty.ratio * 0.5;
		square_slide = -self.duty.sweep * 0.00005;

		if (self.change.amount >= 0) {
			chg_mod = 1.0 - Math.pow(self.change.amount,2) * 0.9;
		}
		else {
			chg_mod = 1.0 + Math.pow(self.change.amount,2) * 10;
		}

		chg_time = 0;
		if (self.change.speed == 1) {
			chg_limit = 0;
		}
		else {
			chg_limit = trunc(Math.pow((1 - self.change.speed),2) * 20000 + 32);
		}
	}
	
	var phase = 0;
	reset();

	var second_sample = false;

	var env_vol = 0;
	var env_stage = 1;
	var env_time = 0;
	var env_length = [
		Math.pow(self.envelope.attack,2) * 100000,
		Math.pow(self.envelope.sustain,2) * 100000,
		Math.pow(self.envelope.decay,2) * 100000
	];

	var fphase = Math.pow(self.phaser.offset,2) * 1020;
	if (self.phaser.offset < 0) fphase = -fphase;
	var dphase = Math.pow(self.phaser.sweep,2);
	if (self.phaser.sweep < 0) dphase = -dphase;
	var ipp = 0;

	var iphase = Math.abs(trunc(fphase));

	var fltp = 0;
	var fltdp = 0;
	var fltw = Math.pow(self.lowpass.cutoff,3) * 0.1;
	var fltw_d = 1 + self.lowpass.sweep * 0.0001;
	var fltdmp = 5 / (1 + Math.pow(self.lowpass.resonance,2) * 20) * (0.01 + fltw);
	fltdmp = clamp(fltdmp, null, 0.8);
	var fltphp = 0;
	var flthp = Math.pow(self.highpass.cutoff,2) * 0.1;
	var flthp_d = 1 + self.highpass.sweep * 0.0003;

	var vib_phase = 0
	var vib_speed = Math.pow(self.vibrato.speed,2) * 0.01;
	var vib_amp = self.vibrato.depth * 0.5;

	var rep_time = 0;
	var rep_limit = trunc(Math.pow((1 - self.repeatspeed),2) * 20000 + 32);
	if (self.repeatspeed == 0) {
		rep_limit = 0;
	}

	// Yay, the main closure

	function next() {
		// Repeat when needed
		rep_time = rep_time + 1;
		if (rep_limit != 0 && rep_time >= rep_limit) {
			rep_time = 0;
			reset();
		}

		// Update the change time and apply it if needed
		chg_time = chg_time + 1;
		if (chg_limit != 0 && chg_time >= chg_limit) {
			chg_limit = 0;
			fperiod = fperiod * chg_mod;
		}

		// Apply the frequency slide and stuff
		slide = slide + dslide;
		fperiod = fperiod * slide;

		if (fperiod > maxperiod) {
			fperiod = maxperiod;
			// XXX: Fail if the minimum frequency is too small
			if (self.frequency.min > 0) {
				return null;
			}
		}

		// Vibrato
		var rfperiod = fperiod;
		if (vib_amp > 0) {
			vib_phase = vib_phase + vib_speed;
			// Apply to the frequency period
			rfperiod = fperiod * (1.0 + Math.sin(vib_phase) * vib_amp);
		}

		// Update the period
		period = trunc(rfperiod);
		if (period < 8) period = 8;

		// Update the square duty
		square_duty = clamp(square_duty + square_slide, 0, 0.5);

		// Volume envelopes

		env_time = env_time + 1;

		if (env_time > env_length[env_stage - 1]) {
			env_time = 0;
			env_stage = env_stage + 1;
			// After the decay stop generating
			if (env_stage == 4) {
				return null;
			}
		}

		// Attack, Sustain, Decay/Release
		if (env_stage == 1) {
			env_vol = env_time / env_length[0];
		}
		else if (env_stage == 2) {
			env_vol = 1 + Math.pow((1 - env_time / env_length[1]),1) * 2 * self.envelope.punch;
		}
		else if (env_stage == 3) {
			env_vol = 1 - env_time / env_length[2];
		}

		// Phaser

		fphase = fphase + dphase;
		iphase = clamp(Math.abs(trunc(fphase)), null, 1023);

		// Filter stuff

		if (flthp_d != 0) {
			flthp = clamp(flthp * flthp_d, 0.00001, 0.1);
		}

		// And finally the actual tone generation and supersampling

		var ssample = 0;
		for (var si = 0; si < self.supersamples-1; si++) {
			var sample = 0;

			phase = phase + 1;

			// fill the noise buffer every period
			if (phase >= period) {
				//phase = 0
				phase = phase % period;
				if (self.wavetype == sfxr.NOISE) {
					for (var i = 0; i < 32; i++) {
						noisebuffer[i] = random(-1, 1);
					}
				}
			}

			// Tone generators ahead!!!

			var fp = phase / period;

			// Square, including square duty
			if (self.wavetype == sfxr.SQUARE) {
				if (fp < square_duty) {
					sample = 0.5;
				}
				else {
					sample = -0.5;
				}
			}
			// Sawtooth
			else if (self.wavetype == sfxr.SAWTOOTH) {
				sample = 1 - fp * 2;
			}
			// Sine
			else if (self.wavetype == sfxr.SINE) {
				sample = Math.sin(fp * 2 * Math.PI);
			}
			// Pitched white noise
			else if (self.wavetype == sfxr.NOISE) {
				sample = noisebuffer[trunc(phase * 32 / period) % 32];
			}

			// Apply the lowpass filter to the sample

			var pp = fltp;
			fltw = clamp(fltw * fltw_d, 0, 0.1);
			if (self.lowpass.cutoff != 1) {
				fltdp = fltdp + (sample - fltp) * fltw;
				fltdp = fltdp - fltdp * fltdmp;
			}
			else {
				fltp = sample;
				fltdp = 0;
			}
			fltp = fltp + fltdp;

			// Apply the highpass filter to the sample

			fltphp = fltphp + (fltp - pp);
			fltphp = fltphp - (fltphp * flthp);
			sample = fltphp;

			// Apply the phaser to the sample

			phaserbuffer[ipp & 1023] = sample;
			sample = sample + phaserbuffer[((ipp - iphase + 1024) & (1023))];
			ipp = ((ipp + 1) & 1023);

			// Accumulation and envelope application
			ssample = ssample + sample * env_vol;
		}

		// Apply the volumes
		ssample = (ssample / self.supersamples) * self.volume.master;
		ssample = ssample * (2 * self.volume.sound);

		// Hard limit
		ssample = clamp(ssample, -1, 1);

		// Frequency conversion
		second_sample = ! second_sample;
		if (freq == sfxr.FREQ_22050 && second_sample) {
			// hah!
			var nsample = next();
			if (nsample) {
				return (ssample + nsample) / 2;
			}
			else {
				return null;
			}
		}

		// bit conversions
		if (bits == sfxr.BITS_FLOAT) {
			return ssample;
		}
		else if (bits == sfxr.BITS_16) {
			return trunc(ssample * 32000);
		}
		else {
			return trunc(ssample * 127 + 128);
		}
	}

	return next;
}

sfxr.Sound.prototype.getEnvelopeLimit = function (freq) {
	var env_length = [
		Math.pow(this.envelope.attack,2) * 100000,
		Math.pow(this.envelope.sustain,2) * 100000,
		Math.pow(this.envelope.decay,2) * 100000
	];
	var limit = trunc(env_length[0] + env_length[1] + env_length[2] + 2);
	
	if ((typeof freq == "undefined") || freq == sfxr.FREQ_44100) {
		return limit;
	}
	else if (freq == sfxr.FREQ_22050) {
		return Math.ceil(limit / 2);
	}
	else {
		//error("Invalid freq argument");
	}
}

sfxr.Sound.prototype.generateTable = function (freq, bits) {
	/*
	local t = {}
	local i = 1
	for v in self:generate(freq, bits) do
		t[i] = v
		i = i + 1
	end
	return t
	*/
	var next = this.generate(freq, bits);
	var t = [];
	var v;
	while((v = next()) !== null){
		t.push(v);
	}
	return t;
}

sfxr.Sound.prototype.generateString = function (freq, bits, endianness) {
	//assert(bits == sfxr.BITS_16 or bits == sfxr.BITS_8, "Invalid bits argument")
	//assert(endianness == "big" or endianness == "little", "Invalid endianness")

	var buf = [];
	
	var v;
	var next = this.generate(freq, bits);
	while((v = next()) !== null) {
		if (bits == sfxr.BITS_8) {
			buf.push(v);
		}
		else {
			if (endianness == "big") {
				buf.push(v >> 8);
				buf.push(v & 0xFF);
			}
			else {
				buf.push(v & 0xFF);
				buf.push(v >> 8);
			}
		}
	}

	return buf.map(c => String.fromCharCode(c)).join("");
}

sfxr.Sound.prototype.generateAudioBuffer = function (freq, audioCtx) {
	freq = freq ? freq : sfxr.FREQ_44100;
	var tab = this.generateTable(freq, sfxr.BITS_FLOAT);

	if (tab.length == 0) {
		return null;
	}
	
	var buf = audioCtx.createBuffer(1, tab.length, freq);
	var data = buf.getChannelData(0);
	
	for(var i = 0; i < tab.length; i++) {
		data[i] = tab[i];
	}
	
	/*
	local data = love.sound.newSoundData(#tab, freq, bits, 1)

	for i = 0, #tab - 1 do
		data:setSample(i, tab[i + 1])
	end
	*/
	
	return buf;
}

sfxr.Sound.prototype.play = function (freq, audioCtx) {
	/*
	local data = self:generateSoundData(freq, bits)

	if data then
		local source = love.audio.newSource(data)
		source:play()
		return source
	end
	*/
	
	var audioBuffer = this.generateAudioBuffer(freq, audioCtx);
	
	var source = audioCtx.createBufferSource();
	source.buffer = audioBuffer;
	source.connect(audioCtx.destination);
	source.start();
}

sfxr.Sound.prototype.randomize = function () {
	var wavetype = this.wavetype;
	this.resetParameters();
	this.wavetype = wavetype;

	if (maybe()) {
		this.repeatspeed = random(0, 1);
	}

	if (maybe()) {
		this.frequency.start = Math.pow(random(-1, 1),3) + 0.5;
	}
	else {
		this.frequency.start = Math.pow(random(-1, 1),2);
	}
	this.frequency.limit = 0;
	this.frequency.slide = Math.pow(random(-1, 1),5);
	if (this.frequency.start > 0.7 && this.frequency.slide > 0.2) {
		this.frequency.slide = -this.frequency.slide;
	}
	else if (this.frequency.start < 0.2 && this.frequency.slide <-0.05) {
		this.frequency.slide = -this.frequency.slide;
	}
	this.frequency.dslide = Math.pow(random(-1, 1),3);

	this.duty.ratio = random(-1, 1);
	this.duty.sweep = Math.pow(random(-1, 1),3);

	this.vibrato.depth = Math.pow(random(-1, 1),3);
	this.vibrato.speed = random(-1, 1);
	this.vibrato.delay = random(-1, 1);

	this.envelope.attack = Math.pow(random(-1, 1),3);
	this.envelope.sustain = Math.pow(random(-1, 1),2);
	this.envelope.punch = Math.pow(random(-1, 1),2);
	this.envelope.decay = random(-1, 1);
	
	if (this.envelope.attack + this.envelope.sustain + this.envelope.decay < 0.2) {
		this.envelope.sustain = this.envelope.sustain + 0.2 + random(0, 0.3);
		this.envelope.decay = this.envelope.decay + 0.2 + random(0, 0.3);
	}

	this.lowpass.resonance = random(-1, 1)
	this.lowpass.cutoff = 1 - Math.pow(random(0, 1),3);
	this.lowpass.sweep = Math.pow(random(-1, 1),3);
	if (this.lowpass.cutoff < 0.1 && this.lowpass.sweep < -0.05) {
		this.lowpass.sweep = -this.lowpass.sweep;
	}
	this.highpass.cutoff = Math.pow(random(0, 1),3);
	this.highpass.sweep = Math.pow(random(-1, 1),5);

	this.phaser.offset = Math.pow(random(-1, 1),3);
	this.phaser.sweep = Math.pow(random(-1, 1),3);

	this.change.speed = random(-1, 1);
	this.change.amount = random(-1, 1);

	this.sanitizeParameters();
}

sfxr.Sound.prototype.mutate = function (amount, seed, changeFreq) {
	amount = (amount ? amount : 1);
	var a = amount / 20;
	var b = (1 - a) * 10;
	var changeFreq = (changeFreq == null) && true || changeFreq;

	if (changeFreq) {
		if (maybe(b)) this.frequency.start = this.frequency.start + random(-a, a);
		if (maybe(b)) this.frequency.slide = this.frequency.slide + random(-a, a);
		if (maybe(b)) this.frequency.dslide = this.frequency.dslide + random(-a, a);
	}

	if (maybe(b))  this.duty.ratio = this.duty.ratio + random(-a, a);
	if (maybe(b))  this.duty.sweep = this.duty.sweep + random(-a, a);

	if (maybe(b))  this.vibrato.depth = this.vibrato.depth + random(-a, a);
	if (maybe(b))  this.vibrato.speed = this.vibrato.speed + random(-a, a);
	if (maybe(b))  this.vibrato.delay = this.vibrato.delay + random(-a, a);

	if (maybe(b))  this.envelope.attack = this.envelope.attack + random(-a, a);
	if (maybe(b))  this.envelope.sustain = this.envelope.sustain + random(-a, a);
	if (maybe(b))  this.envelope.punch = this.envelope.punch + random(-a, a);
	if (maybe(b))  this.envelope.decay = this.envelope.decay + random(-a, a);

	if (maybe(b))  this.lowpass.resonance = this.lowpass.resonance + random(-a, a);
	if (maybe(b))  this.lowpass.cutoff = this.lowpass.cutoff + random(-a, a);
	if (maybe(b))  this.lowpass.sweep = this.lowpass.sweep + random(-a, a);
	if (maybe(b))  this.highpass.cutoff = this.highpass.cutoff + random(-a, a);
	if (maybe(b))  this.highpass.sweep = this.highpass.sweep + random(-a, a);

	if (maybe(b))  this.phaser.offset = this.phaser.offset + random(-a, a);
	if (maybe(b))  this.phaser.sweep = this.phaser.sweep + random(-a, a);

	if (maybe(b))  this.change.speed = this.change.speed + random(-a, a);
	if (maybe(b))  this.change.amount = this.change.amount + random(-a, a);

	if (maybe(b))  this.repeatspeed = this.repeatspeed + random(-a, a);

	this.sanitizeParameters();
}

sfxr.Sound.prototype.randomPickup = function (seed) {
	this.resetParameters();
	this.frequency.start = random(0.4, 0.9);
	this.envelope.attack = 0;
	this.envelope.sustain = random(0, 0.1);
	this.envelope.punch = random(0.3, 0.6);
	this.envelope.decay = random(0.1, 0.5);
	
	if (maybe()) {
		this.change.speed = random(0.5, 0.7);
		this.change.amount = random(0.2, 0.6);
	}
}

sfxr.Sound.prototype.randomLaser = function (seed) {
	this.resetParameters();
	this.wavetype = trunc(random(0, 3));
	if (this.wavetype == sfxr.SINE && maybe()) {
		this.wavetype = trunc(random(0, 1));
	}

	if (maybe(2)) {
		this.frequency.start = random(0.3, 0.9);
		this.frequency.min = random(0, 0.1);
		this.frequency.slide = random(-0.65, -0.35);
	}
	else {
		this.frequency.start = random(0.5, 1);
		this.frequency.min = clamp(this.frequency.start - random(0.2, 0.4), 0.2);
		this.frequency.slide = random(-0.35, -0.15);
	}

	if (maybe()) {
		this.duty.ratio = random(0, 0.5);
		this.duty.sweep = random(0, 0.2);
	}
	else {
		this.duty.ratio = random(0.4, 0.9);
		this.duty.sweep = random(-0.7, 0);
	}

	this.envelope.attack = 0;
	this.envelope.sustain = random(0.1, 0.3);
	this.envelope.decay = random(0, 0.4);

	if (maybe()) {
		this.envelope.punch = random(0, 0.3);
	}

	if (maybe(2)) {
		this.phaser.offset = random(0, 0.2);
		this.phaser.sweep = random(-0.2, 0);
	}

	if (maybe()) {
		this.highpass.cutoff = random(0, 0.3);
	}
}

sfxr.Sound.prototype.randomExplosion = function (seed) {
	this.resetParameters();
	this.wavetype = sfxr.NOISE;
	
	if (maybe()) {
		this.frequency.start = random(0.1, 0.5);
		this.frequency.slide = random(-0.1, 0.3);
	}
	else {
		this.frequency.start = random(0.2, 0.9);
		this.frequency.slide = random(-0.2, -0.4);
	}
	this.frequency.start = Math.pow(this.frequency.start,2);

	if (maybe(4)) {
		this.frequency.slide = 0;
	}
	if (maybe(2)) {
		this.repeatspeed = random(0.3, 0.8);
	}

	this.envelope.attack = 0;
	this.envelope.sustain = random(0.1, 0.4);
	this.envelope.punch = random(0.2, 0.8);
	this.envelope.decay = random(0, 0.5);

	if (maybe()) {
		this.phaser.offset = random(-0.3, 0.6);
		this.phaser.sweep = random(-0.3, 0);
	}
	if (maybe()) {
		this.vibrato.depth = random(0, 0.7);
		this.vibrato.speed = random(0, 0.6);
	}
	if (maybe(2)) {
		this.change.speed = random(0.6, 0.9);
		this.change.amount = random(-0.8, 0.8);
	}
}

sfxr.Sound.prototype.randomPowerup = function (seed) {
	this.resetParameters();
	if (maybe()) {
		this.wavetype = sfxr.SAWTOOTH;
	}
	else {
		this.duty.ratio = random(0, 0.6);
	}

	if (maybe()) {
		this.frequency.start = random(0.2, 0.5);
		this.frequency.slide = random(0.1, 0.5);
		this.repeatspeed = random(0.4, 0.8);
	}
	else {
		this.frequency.start = random(0.2, 0.5);
		this.frequency.slide = random(0.05, 0.25);
		if (maybe()) {
			this.vibrato.depth = random(0, 0.7);
			this.vibrato.speed = random(0, 0.6);
		}
	}
	this.envelope.attack = 0;
	this.envelope.sustain = random(0, 0.4);
	this.envelope.decay = random(0.1, 0.5);
}

sfxr.Sound.prototype.randomHit = function (seed) {
	this.resetParameters();
	this.wavetype = trunc(random(0, 3));

	if (this.wavetype == sfxr.SINE) {
		this.wavetype = sfxr.NOISE;
	}
	else if (this.wavetype == sfxr.SQUARE) {
		this.duty.ratio = random(0, 0.6);
	}

	this.frequency.start = random(0.2, 0.8);
	this.frequency.slide = random(-0.7, -0.3);
	this.envelope.attack = 0;
	this.envelope.sustain = random(0, 0.1);
	this.envelope.decay = random(0.1, 0.3);

	if (maybe()) {
		this.highpass.cutoff = random(0, 0.3);
	}
}

sfxr.Sound.prototype.randomJump = function (seed) {
	this.resetParameters();
	this.wavetype = sfxr.SQUARE;

	this.duty.value = random(0, 0.6);
	this.frequency.start = random(0.3, 0.6);
	this.frequency.slide = random(0.1, 0.3);

	this.envelope.attack = 0;
	this.envelope.sustain = random(0.1, 0.4);
	this.envelope.decay = random(0.1, 0.3);

	if (maybe()) {
		this.highpass.cutoff = random(0, 0.3);
	}
	if (maybe()) {
		this.lowpass.cutoff = random(0.4, 1);
	}
}

sfxr.Sound.prototype.randomBlip = function (seed) {
	this.resetParameters();
	this.wavetype = trunc(random(0, 2));

	if (this.wavetype == sfxr.SQUARE) {
		this.duty.ratio = random(0, 0.6);
	}

	this.frequency.start = random(0.2, 0.6);
	this.envelope.attack = 0;
	this.envelope.sustain = random(0.1, 0.2);
	this.envelope.decay = random(0, 0.2);
	this.highpass.cutoff = 0.1;
}
/*
sfxr.Sound.prototype.exportWAV = function (f, freq, bits) {
	freq = freq or sfxr.FREQ_44100
	bits = bits or sfxr.BITS_16
	assert(freq == sfxr.FREQ_44100 or freq == sfxr.FREQ_22050, "Invalid freq argument")
	assert(bits == sfxr.BITS_16 or bits == sfxr.BITS_8, "Invalid bits argument")

	local close = false
	if type(f) == "string" then
		f = io.open(f, "wb")
		close = true
	end

	-- Some utility functions
	function seek(pos)
		if io.type(f) == "file" then
			f:seek("set", pos)
		else
			f:seek(pos)
		end
	end

	function tell()
		if io.type(f) == "file" then
			return f:seek()
		else
			return f:tell()
		end
	end

	function bytes(num, len)
		local str = ""
		for i = 1, len do
			str = str .. string.char(num % 256)
			num = math.floor(num / 256)
		end
		return str
	end

	function w16(num)
		f:write(bytes(num, 2))
	end

	function w32(num)
		f:write(bytes(num, 4))
	end

	function ws(str)
		f:write(str)
	end

	-- These will hold important file positions
	local pos_fsize
	local pos_csize

	-- Start the file by writing the RIFF header
	ws("RIFF")
	pos_fsize = tell()
	w32(0) -- remaining file size, will be replaced later
	ws("WAVE") -- type

	-- Write the format chunk
	ws("fmt ")
	w32(16) -- chunk size
	w16(1) -- compression code (1 = PCM)
	w16(1) -- channel number
	w32(freq) -- sample rate
	w32(freq * bits / 8) -- bytes per second
	w16(bits / 8) -- block alignment
	w16(bits) -- bits per sample

	-- Write the header of the data chunk
	ws("data")
	pos_csize = tell()
	w32(0) -- chunk size, will be replaced later

	-- Aand write the actual sample data
	local samples = 0

	for v in self:generate(freq, bits) do
		samples = samples + 1

		if bits == sfxr.BITS_16 then
			-- wrap around a bit
			if v >= 256^2 then v = 0 end
			if v < 0 then v = 256^2 + v end
			w16(v)
		else
			f:write(string.char(v))
		end
	end

	-- Seek back to the stored positions
	seek(pos_fsize)
	w32(pos_csize - 4 + samples * bits / 8) -- remaining file size
	seek(pos_csize)
	w32(samples * bits / 8) -- chunk size

	if close then
		f:close()
	end
}

sfxr.Sound.prototype.save = function (f, compressed) {
	local close = false
	if type(f) == "string" then
		f = io.open(f, "w")
		close = true
	end

	local code = "local "

	-- we'll compare the current parameters with the defaults
	local defaults = sfxr.newSound()

	-- this part is pretty awful but it works for now
	function store(keys, obj)
		local name = keys[#keys]

		if type(obj) == "number" then
			-- fetch the default value
			local def = defaults
			for i=2, #keys do
				def = def[keys[i]]
			end

			if obj ~= def then
				local k = table.concat(keys, ".")
				if not compressed then
					code = code .. "\n" .. string.rep(" ", #keys - 1)
				end
				code = code .. string.format("%s=%s;", name, obj)
			end

		elseif type(obj) == "table" then
			local spacing = compressed and "" or "\n" .. string.rep(" ", #keys - 1)
			code = code .. spacing .. string.format("%s={", name)

			for k, v in pairs(obj) do
				local newkeys = shallowcopy(keys)
				newkeys[#newkeys + 1] = k
				store(newkeys, v)
			end

			code = code .. spacing .. "};"
		end
	end

	store({"s"}, self)
	code = code .. "\nreturn s, \"" .. sfxr.VERSION .. "\"" 
	f:write(code)

	if close then
		f:close()
	end
}

sfxr.Sound.prototype.load = function (f) {
	local close = false
	if type(f) == "string" then
		f = io.open(f, "r")
		close = true
	end

	local code
	if io.type(f) == "file" then
		code = f:read("*a")
	else
		code = f:read()
	end

	local params, version = assert(loadstring(code))()
	-- check version compatibility
	if version > sfxr.VERSION then
		return version
	end

	self:resetParameters()
	-- merge the loaded table into the own
	mergetables(self, params)

	if close then
		f:close()
	end
}

sfxr.Sound.prototype.saveBinary = function (f) {
	local close = false
	if type(f) == "string" then
		f = io.open(f, "w")
		close = true
	end

	function writeFloat(x)
		local packed = packIEEE754(x):reverse()
		assert(packed:len() == 4)
		f:write(packed)
	end

	f:write('\x66\x00\x00\x00') -- version 102
	assert(self.wavetype < 256)
	f:write(string.char(self.wavetype) .. '\x00\x00\x00')
	writeFloat(self.volume.sound)

	writeFloat(self.frequency.start)
	writeFloat(self.frequency.min)
	writeFloat(self.frequency.slide)
	writeFloat(self.frequency.dslide)
	writeFloat(self.duty.ratio)
	writeFloat(self.duty.sweep)

	writeFloat(self.vibrato.depth)
	writeFloat(self.vibrato.speed)
	writeFloat(self.vibrato.delay)

	writeFloat(self.envelope.attack)
	writeFloat(self.envelope.sustain)
	writeFloat(self.envelope.decay)
	writeFloat(self.envelope.punch)

	f:write('\x00') -- unused filter_on boolean
	writeFloat(self.lowpass.resonance)
	writeFloat(self.lowpass.cutoff)
	writeFloat(self.lowpass.sweep)
	writeFloat(self.highpass.cutoff)
	writeFloat(self.highpass.sweep)

	writeFloat(self.phaser.offset)
	writeFloat(self.phaser.sweep)

	writeFloat(self.repeatspeed)

	writeFloat(self.change.speed)
	writeFloat(self.change.amount)

	if close then
		f:close()
	end
}

sfxr.Sound.prototype.loadBinary = function (f) {
	local close = false
	if type(f) == "string" then
		f = io.open(f, "r")
		close = true
	end

	local s
	if io.type(f) == "file" then
		s = f:read("*a")
	else
		s = f:read()
	end

	if close then
		f:close()
	end

	self:resetParameters()

	local off = 1

	local function readFloat()
		local f = unpackIEEE754(s:sub(off, off+3):reverse())
		off = off + 4
		return f
	end

	-- Start reading the string

	local version = s:byte(off)
	off = off + 4
	if version < 100 or version > 102 then
		return nil, "unknown version number "..version
	end

	self.wavetype = s:byte(off)
	off = off + 4
	self.volume.sound = version==102 and readFloat() or 0.5

	self.frequency.start = readFloat()
	self.frequency.min = readFloat()
	self.frequency.slide = readFloat()
	self.frequency.dslide = version>=101 and readFloat() or 0

	self.duty.ratio = readFloat()
	self.duty.sweep = readFloat()

	self.vibrato.depth = readFloat()
	self.vibrato.speed = readFloat()
	self.vibrato.delay = readFloat()

	self.envelope.attack = readFloat()
	self.envelope.sustain = readFloat()
	self.envelope.decay = readFloat()
	self.envelope.punch = readFloat()

	off = off + 1 -- filter_on - seems to be ignored in the C++ version
	self.lowpass.resonance = readFloat()
	self.lowpass.cutoff = readFloat()
	self.lowpass.sweep = readFloat()
	self.highpass.cutoff = readFloat()
	self.highpass.sweep = readFloat()

	self.phaser.offset = readFloat()
	self.phaser.sweep = readFloat()

	self.repeatspeed = readFloat()

	if version >= 101 then
		self.change.speed = readFloat()
		self.change.amount = readFloat()
	end

	assert(off-1 == s:len())
}
*/

return sfxr; })();