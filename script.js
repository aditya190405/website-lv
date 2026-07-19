// Ambient Piano Synthesizer using Web Audio API (Chords & Melody: "A Thousand Years")
class AmbientSynth {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.tempo = 140; // BPM
    this.beatDuration = 60 / this.tempo; // time of one eighth note beat
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.1; // sec
    this.nextNoteTime = 0.0;
    this.noteIndex = 0;
    this.timerId = null;
    this.gainNode = null;
    this.delayNode = null;
    this.delayGain = null;
    
    // Frequencies mapping
    this.pitches = {
      'G2': 98.00, 'F#2': 92.50, 'E2': 82.41, 'C2': 65.41, 'B2': 123.47, 'A2': 110.00, 'D2': 73.42,
      'G3': 196.00, 'F#3': 185.00, 'E3': 164.81, 'C3': 130.81, 'B3': 246.94, 'A3': 220.00, 'D3': 146.83,
      'G4': 392.00, 'F#4': 369.99, 'E4': 329.63, 'C4': 261.63, 'B4': 493.88, 'A4': 440.00, 'D4': 293.66,
      'G5': 783.99, 'F#5': 739.99, 'E5': 659.25, 'D5': 587.33, 'C5': 523.25, 'B5': 987.77, 'A5': 880.00
    };

    // Arpeggio structure (6 steps per bar) - 8 bars total
    this.arpeggios = [
      { bass: 'G2', mid: ['G3', 'D4', 'G4', 'B4', 'G4', 'D4'] },
      { bass: 'F#2', mid: ['F#3', 'D4', 'F#4', 'A4', 'F#4', 'D4'] },
      { bass: 'E2', mid: ['E3', 'B3', 'E4', 'G4', 'E4', 'B3'] },
      { bass: 'D2', mid: ['D3', 'A3', 'D4', 'F#4', 'D4', 'A3'] },
      { bass: 'C2', mid: ['C3', 'G3', 'C4', 'E4', 'C4', 'G3'] },
      { bass: 'B2', mid: ['B3', 'G3', 'D4', 'G4', 'D4', 'G3'] },
      { bass: 'A2', mid: ['A3', 'E3', 'A3', 'C4', 'E4', 'C4'] },
      { bass: 'D2', mid: ['D3', 'A3', 'D4', 'F#4', 'D4', 'A3'] }
    ];

    // Melody sheet of "A Thousand Years" chorus
    this.melody = [
      { step: 0, pitch: 'D5', len: 1.5 },
      { step: 2, pitch: 'D5', len: 0.5 },
      { step: 3, pitch: 'C5', len: 1.0 },
      { step: 4, pitch: 'B4', len: 2.0 },
      { step: 6, pitch: 'D5', len: 1.5 },
      { step: 8, pitch: 'C5', len: 0.5 },
      { step: 9, pitch: 'B4', len: 1.0 },
      { step: 10, pitch: 'G4', len: 2.0 },
      { step: 12, pitch: 'A4', len: 1.5 },
      { step: 14, pitch: 'G4', len: 0.5 },
      { step: 15, pitch: 'F#4', len: 1.0 },
      { step: 16, pitch: 'G4', len: 2.0 },
      { step: 18, pitch: 'A4', len: 1.0 },
      { step: 19, pitch: 'B4', len: 1.0 },
      { step: 20, pitch: 'A4', len: 1.0 },
      { step: 21, pitch: 'D5', len: 1.5 },
      { step: 23, pitch: 'D5', len: 0.5 },
      { step: 24, pitch: 'C5', len: 1.0 },
      { step: 25, pitch: 'B4', len: 2.0 },
      { step: 27, pitch: 'D5', len: 1.5 },
      { step: 29, pitch: 'C5', len: 0.5 },
      { step: 30, pitch: 'B4', len: 1.0 },
      { step: 31, pitch: 'G4', len: 2.0 },
      { step: 33, pitch: 'A4', len: 1.5 },
      { step: 35, pitch: 'G4', len: 0.5 },
      { step: 36, pitch: 'F#4', len: 1.0 },
      { step: 37, pitch: 'G4', len: 3.0 },
      { step: 42, pitch: 'D5', len: 1.0 },
      { step: 43, pitch: 'G5', len: 1.0 },
      { step: 44, pitch: 'F#5', len: 1.0 },
      { step: 45, pitch: 'D5', len: 3.0 }
    ];
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime); // Soft background volume
    
    // Lowpass filter to make synthesis warm and cozy
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, this.ctx.currentTime);
    
    // Ethereal delay line
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.setValueAtTime(this.beatDuration * 2.0, this.ctx.currentTime); // 2-beat delay
    
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.setValueAtTime(0.35, this.ctx.currentTime); // Feedback level
    
    // Connect delay feedback loop
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.delayNode);
    
    // Connect Graph
    filter.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    
    filter.connect(this.delayNode);
    this.delayNode.connect(this.gainNode);
  }

  playNote(frequency, time, duration, volume = 0.1, attack = 0.08, release = 0.5, waveType = 'triangle') {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = waveType;
    osc.frequency.setValueAtTime(frequency, time);
    
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(volume, time + attack);
    gainNode.gain.setValueAtTime(volume, time + duration - release);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.gainNode);
    
    osc.start(time);
    osc.stop(time + duration);
  }

  scheduleNote(step, time) {
    const bar = Math.floor(step / 6) % 8;
    const stepInBar = step % 6;
    
    const chordInfo = this.arpeggios[bar];
    
    if (stepInBar === 0) {
      const bassFreq = this.pitches[chordInfo.bass];
      if (bassFreq) {
        this.playNote(bassFreq, time, this.beatDuration * 5.8, 0.16, 0.15, 1.2, 'sine');
      }
    }
    
    const arpeggioPitch = chordInfo.mid[stepInBar];
    const arpeggioFreq = this.pitches[arpeggioPitch];
    if (arpeggioFreq) {
      this.playNote(arpeggioFreq, time, this.beatDuration * 1.5, 0.07, 0.08, 0.4, 'triangle');
    }
    
    const melodyNotes = this.melody.filter(n => n.step === step);
    melodyNotes.forEach(note => {
      const melodyFreq = this.pitches[note.pitch];
      if (melodyFreq) {
        this.playNote(melodyFreq, time, note.len * this.beatDuration, 0.16, 0.05, 0.35, 'sine');
        this.playNote(melodyFreq, time, note.len * this.beatDuration, 0.04, 0.08, 0.35, 'triangle');
      }
    });
  }

  scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.noteIndex, this.nextNoteTime);
      this.nextNote();
    }
    this.timerId = setTimeout(() => this.scheduler(), this.lookahead);
  }

  nextNote() {
    this.nextNoteTime += this.beatDuration;
    this.noteIndex = (this.noteIndex + 1) % 48; // loop after 48 steps
  }

  start() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPlaying = true;
    this.noteIndex = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    clearTimeout(this.timerId);
  }
}

// Particle System: Floating hearts background
class HeartParticles {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.maxParticles = 35;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  spawnParticle() {
    const isFilled = Math.random() > 0.6;
    return {
      x: Math.random() * this.canvas.width,
      y: this.canvas.height + 20,
      size: 8 + Math.random() * 14,
      speed: 0.5 + Math.random() * 0.8,
      opacity: 0.1 + Math.random() * 0.35,
      angle: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.01 + Math.random() * 0.02,
      wobbleRange: 0.5 + Math.random() * 1.0,
      filled: isFilled
    };
  }
  
  drawHeartShape(x, y, size) {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    // Draw left curve
    this.ctx.bezierCurveTo(x - size / 2, y - size / 2, x - size, y + size / 3, x, y + size);
    // Draw right curve
    this.ctx.bezierCurveTo(x + size, y + size / 3, x + size / 2, y - size / 2, x, y);
    this.ctx.closePath();
  }
  
  update() {
    if (this.particles.length < this.maxParticles && Math.random() < 0.05) {
      this.particles.push(this.spawnParticle());
    }
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const heartColor = getComputedStyle(document.documentElement).getPropertyValue('--heart-color').trim();
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      p.y -= p.speed;
      p.angle += p.wobbleSpeed;
      p.x += Math.sin(p.angle) * p.wobbleRange * 0.5;
      
      // Fade out near the top
      let currentOpacity = p.opacity;
      if (p.y < 150) {
        currentOpacity *= (p.y / 150);
      }
      
      if (p.y < -20 || currentOpacity <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = currentOpacity;
      
      if (p.filled) {
        this.ctx.fillStyle = heartColor;
        this.drawHeartShape(p.x, p.y, p.size);
        this.ctx.fill();
      } else {
        this.ctx.strokeStyle = heartColor;
        this.ctx.lineWidth = 1.5;
        this.drawHeartShape(p.x, p.y, p.size);
        this.ctx.stroke();
      }
      
      this.ctx.restore();
    }
  }
  
  loop() {
    this.update();
    requestAnimationFrame(() => this.loop());
  }
}

// Confetti Climax System
class ConfettiSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.active = false;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  trigger() {
    if (this.active) return;
    this.active = true;
    this.particles = [];
    
    const colors = ['#E57373', '#FF8A80', '#FFCDD2', '#FFF9C4', '#E1BEE7', '#FCE4EC'];
    
    // Spawn 150 confetti particles bursting from the center bottom
    for (let i = 0; i < 150; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * 1.2; // upwards spread
      const speed = 8 + Math.random() * 12;
      this.particles.push({
        x: this.canvas.width / 2,
        y: this.canvas.height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: -0.1 + Math.random() * 0.2,
        opacity: 1,
        type: Math.random() > 0.5 ? 'heart' : 'circle',
        gravity: 0.15,
        friction: 0.98
      });
    }
    
    this.loop();
  }
  
  drawHeartShape(x, y, size) {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.bezierCurveTo(x - size / 2, y - size / 2, x - size, y + size / 3, x, y + size);
    this.ctx.bezierCurveTo(x + size, y + size / 3, x + size / 2, y - size / 2, x, y);
    this.ctx.closePath();
  }
  
  loop() {
    if (!this.active || this.particles.length === 0) {
      this.active = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Apply forces
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.vy += p.gravity;
      
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      
      // Fade out slowly after starting to fall
      if (p.vy > 1) {
        p.opacity -= 0.01;
      }
      
      if (p.y > this.canvas.height + 20 || p.opacity <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.fillStyle = p.color;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      
      if (p.type === 'heart') {
        this.drawHeartShape(0, 0, p.size);
        this.ctx.fill();
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.restore();
    }
    
    requestAnimationFrame(() => this.loop());
  }
}

// 20 heartfelt reasons why Vivi is special
const reasons = [
  "Caramu tertawa selalu bisa menghapus semua kelelahan dan kesedihan di hariku.",
  "Senyummu adalah hal terindah yang selalu ingin aku lihat setiap hari.",
  "Kamu memiliki hati yang sangat tulus, sesuatu yang jarang kutemui pada orang lain.",
  "Caramu berbicara dan mendengarkanku membuatku merasa sangat dihargai.",
  "Perhatian kecil yang kamu berikan selalu berhasil membuatku merasa istimewa.",
  "Kesabaranmu dalam menghadapiku, bahkan ketika aku membuat kesalahan.",
  "Kehadiranmu membawa kedamaian dan kenyamanan yang tidak bisa digantikan oleh siapa pun.",
  "Caramu peduli pada hal-hal kecil tentang diriku yang bahkan sering kulupakan.",
  "Kehangatan yang terpancar dari dirimu setiap kali kita berbagi cerita.",
  "Caramu menatapku membuatku merasa aman dan dicintai sepenuhnya.",
  "Kamu adalah pendengar terbaik yang selalu bisa memahami apa yang sedang kupikirkan.",
  "Kedewasaanmu dalam berpikir dan caramu menuntunku menjadi orang yang lebih baik.",
  "Kepedulianmu yang begitu besar terhadap orang-orang di sekitarmu.",
  "Caramu membuat hal-hal biasa terasa sangat menyenangkan saat kita bersama.",
  "Sifat humorismu yang selalu berhasil membuatku tersenyum dalam situasi apa pun.",
  "Ketulusan dalam setiap tindakan dan kata-kata yang keluar darimu.",
  "Bagaimana caramu selalu mendukungku dalam keadaan apa pun tanpa ragu.",
  "Quirk kecil dan kebiasaan-kebiasaan lucumu yang selalu membuatku merasa gemas.",
  "Caramu mengajarkanku arti dari sebuah ketulusan dan saling memahami.",
  "Sederhananya, karena kamu adalah Vivi—seseorang yang tak pernah ingin aku hilangkan dari hidupku."
];

// Gallery Images Metadata (using JPEGs updated from Vivi's assets)
const galleryImages = [
  { src: 'assets/first_date.jpg', caption: 'The Day We Met' },
  { src: 'assets/cozy_cafe.jpg', caption: 'Cozy Conversations' },
  { src: 'assets/stargazing.jpg', caption: 'Under the Stars' },
  { src: 'assets/sunset.jpg', caption: 'Sunset Together' }
];

document.addEventListener('DOMContentLoaded', () => {
  // 1. Setup Theme Manager
  const themeToggleBtn = document.getElementById('theme-toggle');
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');
  
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);
  
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
  });
  
  function updateThemeIcons(theme) {
    if (theme === 'dark') {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    } else {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    }
  }

  // 2. Setup Ambient Synth & Control
  const synth = new AmbientSynth();
  const musicToggleBtn = document.getElementById('music-toggle');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  
  let musicInitiated = false;
  
  const musicControlContainer = document.getElementById('music-control-container');

  function toggleMusic() {
    if (!musicInitiated) {
      synth.start();
      musicInitiated = true;
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      musicControlContainer.classList.add('playing');
    } else {
      if (synth.isPlaying) {
        synth.stop();
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        musicControlContainer.classList.remove('playing');
      } else {
        synth.start();
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        musicControlContainer.classList.add('playing');
      }
    }
  }
  
  musicToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMusic();
  });

  // Autoplay music upon first scroll or interaction
  const initMusicOnInteraction = () => {
    if (!musicInitiated) {
      toggleMusic();
    }
    // Remove listeners once activated
    window.removeEventListener('scroll', initMusicOnInteraction);
    window.removeEventListener('click', initMusicOnInteraction);
    window.removeEventListener('touchstart', initMusicOnInteraction);
  };
  
  window.addEventListener('scroll', initMusicOnInteraction, { passive: true });
  window.addEventListener('click', initMusicOnInteraction);
  window.addEventListener('touchstart', initMusicOnInteraction, { passive: true });

  // 3. Inject Reasons I Love You Cards
  const reasonsGrid = document.getElementById('reasons-grid');
  reasons.forEach((reason, index) => {
    const card = document.createElement('div');
    card.className = 'reason-card body-font';
    card.style.transitionDelay = `${(index % 4) * 0.1}s`; // staggered slide columns
    
    card.innerHTML = `
      <div class="reason-num">${index + 1}</div>
      <p>${reason}</p>
    `;
    reasonsGrid.appendChild(card);
  });

  // 4. Cursor Glow Tracker
  const cursorGlow = document.getElementById('cursor-glow');
  let cursorX = 0, cursorY = 0;
  let glowX = 0, glowY = 0;
  
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  
  if (isFinePointer) {
    window.addEventListener('mousemove', (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
    });
    
    // Eased coordinates mapping for smooth cinematic lag
    const updateCursorGlowPosition = () => {
      const dx = cursorX - glowX;
      const dy = cursorY - glowY;
      
      glowX += dx * 0.12;
      glowY += dy * 0.12;
      
      cursorGlow.style.top = `${glowY}px`;
      cursorGlow.style.left = `${glowX}px`;
      
      requestAnimationFrame(updateCursorGlowPosition);
    };
    updateCursorGlowPosition();
  } else {
    // Hide glow completely on touch screens
    cursorGlow.style.display = 'none';
  }

  // 5. Setup Floating Particles
  const particles = new HeartParticles('particles-canvas');
  particles.loop();

  // 6. Setup Confetti System
  const confetti = new ConfettiSystem('confetti-canvas');

  // 7. Scroll-Trigger / Fade-Up Elements using IntersectionObserver
  const revealElements = [
    ...document.querySelectorAll('.letter-p'),
    ...document.querySelectorAll('.timeline-item'),
    ...document.querySelectorAll('.gallery-item'),
    ...document.querySelectorAll('.reason-card'),
    document.querySelector('.promise-quote'),
    document.querySelector('.final-content')
  ];

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px', // Trigger slightly before scrolling onto the viewport
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        
        // Climax Trigger: Confetti on reaching the final screen
        if (entry.target.classList.contains('final-content')) {
          confetti.trigger();
        }
        
        // Stop observing once animated
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  revealElements.forEach(el => {
    if (el) observer.observe(el);
  });

  // 8. Typewriter Effect (Hero title)
  const titleText = "A Letter For You";
  const typewriterSpan = document.getElementById('typewriter-title');
  let typeIndex = 0;
  
  function typeWriter() {
    if (typeIndex < titleText.length) {
      typewriterSpan.textContent += titleText.charAt(typeIndex);
      typeIndex++;
      setTimeout(typeWriter, 120 + Math.random() * 60);
    }
  }

  // 9. Loader Screen Fade-out
  window.addEventListener('load', () => {
    // Minimum visual hold of 1.6 seconds for beating heart animation
    setTimeout(() => {
      const loader = document.getElementById('loader-screen');
      loader.style.opacity = '0';
      setTimeout(() => {
        loader.style.display = 'none';
        // Trigger hero typing effect once loaded
        typeWriter();
      }, 800);
    }, 1600);
  });

  // 10. Navigation button scrolling (Continue triggers)
  const continueButtons = document.querySelectorAll('.continue-btn, #hero-scroll-btn');
  continueButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      let targetId = btn.getAttribute('data-target');
      if (!targetId) {
        targetId = btn.getAttribute('href');
      }
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // 11. Lightbox Image Gallery
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCaption = document.getElementById('lightbox-caption');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxPrev = document.getElementById('lightbox-prev');
  const lightboxNext = document.getElementById('lightbox-next');
  let currentImgIndex = 0;

  const galleryItems = document.querySelectorAll('.gallery-item');
  
  function openLightbox(index) {
    currentImgIndex = index;
    updateLightboxImg();
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
  }

  function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = ''; // Unlock scrolling
  }

  function updateLightboxImg() {
    const data = galleryImages[currentImgIndex];
    lightboxImg.src = data.src;
    lightboxImg.alt = data.caption;
    lightboxCaption.textContent = data.caption;
  }

  function nextImage() {
    currentImgIndex = (currentImgIndex + 1) % galleryImages.length;
    updateLightboxImg();
  }

  function prevImage() {
    currentImgIndex = (currentImgIndex - 1 + galleryImages.length) % galleryImages.length;
    updateLightboxImg();
  }

  galleryItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      openLightbox(index);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxNext.addEventListener('click', nextImage);
  lightboxPrev.addEventListener('click', prevImage);
  
  // Close on backdrop click
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Keyboard navigation for lightbox
  window.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('active')) return;
    
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
  });
});
