/* ==========================================================================
   Bodi.az — Scroll Animations & Interactive Carousel System
   Powered by GSAP 3 + ScrollTrigger with smooth fallback & touch support
   ========================================================================== */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------------------------
     1. DRAG-TO-SCROLL CONTROLLER (Mouse drag + Touch momentum + Click guard)
     -------------------------------------------------------------------------- */
  function enableDragScroll(track) {
    if (!track || track.dataset.dragScrollArmed === "true") return;
    track.dataset.dragScrollArmed = "true";
    track.classList.add("drag-scroll-track");

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;
    let velocity = 0;
    let lastX = 0;
    let lastTime = 0;
    let momentumId = null;

    function stopMomentum() {
      if (momentumId) {
        cancelAnimationFrame(momentumId);
        momentumId = null;
      }
    }

    track.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return; // Left mouse button only
      stopMomentum();
      isDown = true;
      hasDragged = false;
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
      lastX = e.pageX;
      lastTime = performance.now();
      velocity = 0;
    });

    window.addEventListener("mousemove", function (e) {
      if (!isDown) return;
      const x = e.pageX - track.offsetLeft;
      const walk = x - startX;

      // Only enter drag mode after real movement: "is-dragging" disables pointer
      // events on the cards, and setting it on mousedown made plain clicks miss
      // their links (mouseup landed on the track instead of the card).
      if (Math.abs(walk) > 6 && !hasDragged) {
        hasDragged = true;
        track.classList.add("is-dragging");
      }

      if (hasDragged) {
        e.preventDefault();
        track.scrollLeft = scrollLeft - walk;

        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 8) {
          velocity = (e.pageX - lastX) / dt;
          lastX = e.pageX;
          lastTime = now;
        }
      }
    }, { passive: false });

    function onMouseUpOrLeave() {
      if (!isDown) return;
      isDown = false;
      track.classList.remove("is-dragging");

      // Decay velocity if held stationary before releasing
      if (performance.now() - lastTime > 70) {
        velocity = 0;
      }

      if (hasDragged) {
        setTimeout(function () {
          hasDragged = false;
        }, 60);

        // Inertia momentum glide
        if (Math.abs(velocity) > 0.15) {
          let currentStep = -velocity * 16;
          const friction = 0.92;

          function glide() {
            if (Math.abs(currentStep) < 0.4) {
              stopMomentum();
              return;
            }
            track.scrollLeft += currentStep;
            currentStep *= friction;
            momentumId = requestAnimationFrame(glide);
          }
          momentumId = requestAnimationFrame(glide);
        }
      }
    }

    window.addEventListener("mouseup", onMouseUpOrLeave);
    window.addEventListener("blur", function () {
      if (isDown) {
        isDown = false;
        track.classList.remove("is-dragging");
        stopMomentum();
      }
    });

    // Suppress accidental link clicks or button triggers if user dragged
    track.addEventListener("click", function (e) {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
      }
    }, true);

    // Stop native image/link drag ghost
    track.addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
  }

  /* --------------------------------------------------------------------------
     2. CAROUSEL CONTROLLERS (Touch swipe, arrows, progress dots)
     -------------------------------------------------------------------------- */
  function initCarousels() {
    setupTrackCarousel({
      trackId: "catTrack",
      prevBtnId: "catPrev",
      nextBtnId: "catNext",
      dotsId: "catDots",
      itemSelector: ".cat-card"
    });

    setupTrackCarousel({
      trackId: "featured-track",
      prevBtnId: "featPrev",
      nextBtnId: "featNext",
      dotsId: "featDots",
      itemSelector: ".group"
    });

    setupTrackCarousel({
      trackId: "new-track",
      prevBtnId: "newPrev",
      nextBtnId: "newNext",
      dotsId: "newDots",
      itemSelector: ".group"
    });

    setupReviewsDots();

    // Trust section mobile scrollable track
    const trustTrack = document.querySelector("#trust-section > div");
    if (trustTrack) enableDragScroll(trustTrack);
  }

  function setupTrackCarousel(config) {
    const track = document.getElementById(config.trackId);
    if (!track) return;

    enableDragScroll(track);

    const prevBtn = document.getElementById(config.prevBtnId);
    const nextBtn = document.getElementById(config.nextBtnId);
    const dotsContainer = document.getElementById(config.dotsId);

    function getStep() {
      const item = track.querySelector(config.itemSelector);
      if (!item) return 320;
      return item.offsetWidth + 20; // 1 full item plus gap
    }

    if (prevBtn) {
      prevBtn.onclick = function () {
        track.scrollBy({ left: -getStep(), behavior: "smooth" });
      };
    }

    if (nextBtn) {
      nextBtn.onclick = function () {
        track.scrollBy({ left: getStep(), behavior: "smooth" });
      };
    }

    // Build dots
    function updateDots() {
      if (!dotsContainer) return;
      const items = track.querySelectorAll(config.itemSelector);
      if (items.length <= 1) {
        dotsContainer.innerHTML = "";
        return;
      }

      const totalWidth = track.scrollWidth - track.clientWidth;
      if (totalWidth <= 10) {
        dotsContainer.innerHTML = "";
        return;
      }

      const numDots = Math.min(items.length, 6);
      if (dotsContainer.children.length !== numDots) {
        dotsContainer.innerHTML = "";
        for (let i = 0; i < numDots; i++) {
          const dot = document.createElement("button");
          dot.type = "button";
          dot.setAttribute("aria-label", "Slayd " + (i + 1));
          dot.className = "h-2 rounded-full transition-all duration-300 " + (i === 0 ? "w-6 bg-primary" : "w-2 bg-outline-variant/60");
          (function (idx) {
            dot.onclick = function () {
              const targetLeft = (totalWidth / (numDots - 1)) * idx;
              track.scrollTo({ left: targetLeft, behavior: "smooth" });
            };
          })(i);
          dotsContainer.appendChild(dot);
        }
      }

      const progress = totalWidth > 0 ? track.scrollLeft / totalWidth : 0;
      const activeIdx = Math.min(Math.round(progress * (numDots - 1)), numDots - 1);
      Array.from(dotsContainer.children).forEach(function (dot, idx) {
        if (idx === activeIdx) {
          dot.className = "h-2 w-6 rounded-full bg-primary transition-all duration-300 shadow-xs";
        } else {
          dot.className = "h-2 w-2 rounded-full bg-outline-variant/60 hover:bg-outline-variant transition-all duration-300";
        }
      });
    }

    let scrollTimeout;
    track.addEventListener("scroll", function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateDots, 50);
    }, { passive: true });

    setTimeout(updateDots, 150);
    window.addEventListener("resize", function () { setTimeout(updateDots, 100); }, { passive: true });
  }

  function setupReviewsDots() {
    const slider = document.getElementById("rvSlider");
    const dotsContainer = document.getElementById("rvDots");
    if (!slider) return;

    enableDragScroll(slider);
    if (!dotsContainer) return;

    function renderDots() {
      const cards = slider.querySelectorAll(".rv-card");
      if (cards.length <= 1) return;
      const totalWidth = slider.scrollWidth - slider.clientWidth;
      if (totalWidth <= 10) return;

      const numDots = Math.min(cards.length, 6);
      dotsContainer.innerHTML = "";
      for (let i = 0; i < numDots; i++) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", "Rəy " + (i + 1));
        dot.className = "h-2 rounded-full transition-all duration-300 " + (i === 0 ? "w-6 bg-primary" : "w-2 bg-outline-variant/60");
        (function (idx) {
          dot.onclick = function () {
            const target = (totalWidth / (numDots - 1)) * idx;
            slider.scrollTo({ left: target, behavior: "smooth" });
          };
        })(i);
        dotsContainer.appendChild(dot);
      }

      function updateActive() {
        const p = totalWidth > 0 ? slider.scrollLeft / totalWidth : 0;
        const active = Math.min(Math.round(p * (numDots - 1)), numDots - 1);
        Array.from(dotsContainer.children).forEach(function (dot, idx) {
          if (idx === active) {
            dot.className = "h-2 w-6 rounded-full bg-primary transition-all duration-300 shadow-xs";
          } else {
            dot.className = "h-2 w-2 rounded-full bg-outline-variant/60 hover:bg-outline-variant transition-all duration-300";
          }
        });
      }

      slider.addEventListener("scroll", updateActive, { passive: true });
    }

    setTimeout(renderDots, 200);
    window.addEventListener("bodi:reviews-updated", function () { setTimeout(renderDots, 150); });
  }

  /* --------------------------------------------------------------------------
     2. FLOATING WHATSAPP CTA WITH SCROLL TRIGGER
     -------------------------------------------------------------------------- */
  function initFloatingCTA() {
    const fab = document.getElementById("floating-wa");
    if (!fab) return;

    let isVisible = false;
    function checkScroll() {
      const scrollY = window.scrollY;
      if (scrollY > 300) {
        if (!isVisible) {
          isVisible = true;
          fab.classList.remove("opacity-0", "translate-y-8", "pointer-events-none");
          fab.classList.add("opacity-100", "translate-y-0", "pointer-events-auto");
        }
      } else {
        if (isVisible) {
          isVisible = false;
          fab.classList.add("opacity-0", "translate-y-8", "pointer-events-none");
          fab.classList.remove("opacity-100", "translate-y-0", "pointer-events-auto");
        }
      }
    }

    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
  }

  /* --------------------------------------------------------------------------
     3. GSAP + SCROLLTRIGGER ANIMATIONS
     -------------------------------------------------------------------------- */
  function initScrollAnimations() {
    if (prefersReducedMotion) {
      document.querySelectorAll(".reveal, .gsap-reveal").forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }

    if (typeof gsap === "undefined") {
      return;
    }

    if (typeof ScrollTrigger !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);
    }

    // 1. HERO ANIMATION
    var heroBadge = document.querySelector("#hero-content .inline-flex");
    var heroH1 = document.querySelector("#hero-content h1");
    var heroP = document.querySelector("#hero-content p");
    var heroBtns = document.querySelector("#hero-content .pt-2");

    var heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (heroBadge) {
      heroTl.fromTo(heroBadge, 
        { opacity: 0, y: -18, scale: 0.92 }, 
        { opacity: 1, y: 0, scale: 1, duration: 0.65, delay: 0.1 }
      );
    }

    if (heroH1) {
      heroTl.fromTo(heroH1, 
        { opacity: 0, y: 24 }, 
        { opacity: 1, y: 0, duration: 0.75 }, 
        "-=0.4"
      );
    }

    if (heroP) {
      heroTl.fromTo(heroP, 
        { opacity: 0, y: 18 }, 
        { opacity: 1, y: 0, duration: 0.65 }, 
        "-=0.45"
      );
    }

    if (heroBtns) {
      heroTl.fromTo(heroBtns, 
        { opacity: 0, y: 14, scale: 0.96 }, 
        { opacity: 1, y: 0, scale: 1, duration: 0.6 }, 
        "-=0.4"
      );
    }

    // ScrollTrigger elements
    if (typeof ScrollTrigger !== "undefined") {
      
      // 2. TRUST BAR
      var trustSection = document.querySelector("#trust-section");
      if (trustSection) {
        gsap.fromTo(trustSection.querySelectorAll(".trust-card"), 
          { opacity: 0, y: 25 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.12,
            ease: "power2.out",
            scrollTrigger: {
              trigger: trustSection,
              start: "top 88%",
              once: true
            }
          }
        );
      }

      // 3. CATEGORIES SECTION
      var catSection = document.querySelector("#categories-section");
      if (catSection) {
        gsap.fromTo(catSection.querySelectorAll(".cat-card"), 
          { opacity: 0, y: 35, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            stagger: 0.15,
            ease: "power3.out",
            scrollTrigger: {
              trigger: catSection,
              start: "top 82%",
              once: true
            }
          }
        );
      }

      // 4. FEATURED PRODUCTS SECTION
      var featSection = document.querySelector("#featured-section");
      if (featSection) {
        ScrollTrigger.create({
          trigger: featSection,
          start: "top 82%",
          once: true,
          onEnter: function () {
            var cards = featSection.querySelectorAll(".group");
            if (cards.length) {
              gsap.fromTo(cards, 
                { opacity: 0, y: 30, scale: 0.97 },
                { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }
              );
            }
          }
        });
      }

      // 5. PROMO BANNER
      var promoSection = document.querySelector("#promo-section");
      if (promoSection) {
        var promoBox = promoSection.querySelector(".promo-box");
        var promoImg = promoSection.querySelector("#promo-img");
        
        if (promoBox) {
          gsap.fromTo(promoBox,
            { opacity: 0, y: 35, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: promoSection,
                start: "top 85%",
                once: true
              }
            }
          );
        }

        if (promoImg) {
          gsap.fromTo(promoImg,
            { scale: 1.08, y: 15 },
            {
              scale: 1,
              y: 0,
              duration: 1.2,
              ease: "power2.out",
              scrollTrigger: {
                trigger: promoSection,
                start: "top 80%",
                once: true
              }
            }
          );
        }
      }

      // 6. NEW PRODUCTS SECTION
      var newSection = document.querySelector("#new-section");
      if (newSection) {
        ScrollTrigger.create({
          trigger: newSection,
          start: "top 82%",
          once: true,
          onEnter: function () {
            var cards = newSection.querySelectorAll(".group");
            if (cards.length) {
              gsap.fromTo(cards, 
                { opacity: 0, y: 30, scale: 0.97 },
                { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08, ease: "power2.out" }
              );
            }
          }
        });
      }

      // 7. VALUES SECTION
      var valuesSection = document.querySelector("#values-section");
      if (valuesSection) {
        var valueCards = valuesSection.querySelectorAll(".value-card");
        gsap.fromTo(valueCards,
          { opacity: 0, y: 35 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.16,
            ease: "power2.out",
            scrollTrigger: {
              trigger: valuesSection,
              start: "top 80%",
              once: true
            }
          }
        );

        var icons = valuesSection.querySelectorAll(".value-icon");
        if (icons.length) {
          gsap.fromTo(icons,
            { scale: 0.6, rotation: -10 },
            {
              scale: 1,
              rotation: 0,
              duration: 0.8,
              stagger: 0.16,
              ease: "back.out(1.8)",
              scrollTrigger: {
                trigger: valuesSection,
                start: "top 78%",
                once: true
              }
            }
          );
        }
      }

      // 8. REVIEWS SECTION
      var rvSection = document.querySelector(".rv-section");
      if (rvSection) {
        gsap.fromTo(rvSection.querySelector(".rv-header"),
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            ease: "power2.out",
            scrollTrigger: {
              trigger: rvSection,
              start: "top 85%",
              once: true
            }
          }
        );

        gsap.fromTo(rvSection.querySelector(".rv-slider-wrapper"),
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: rvSection,
              start: "top 80%",
              once: true
            }
          }
        );
      }
    }
  }

  function boot() {
    initCarousels();
    initFloatingCTA();
    initScrollAnimations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("bodi:products-updated", function () {
    initCarousels();
    if (typeof ScrollTrigger !== "undefined") {
      setTimeout(function () { ScrollTrigger.refresh(); }, 120);
    }
  });

  window.addEventListener("bodi:reviews-updated", function () {
    initCarousels();
    if (typeof ScrollTrigger !== "undefined") {
      setTimeout(function () { ScrollTrigger.refresh(); }, 120);
    }
  });

  window.addEventListener("bodi:homepage-updated", function () {
    initCarousels();
    if (typeof ScrollTrigger !== "undefined") {
      setTimeout(function () { ScrollTrigger.refresh(); }, 120);
    }
  });

})();
