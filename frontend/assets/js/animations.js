/* ==========================================================================
   Bodi.az — Scroll Animations & Interactive Carousel System
   Powered by GSAP 3 + ScrollTrigger with smooth fallback & touch support
   ========================================================================== */

(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------------------------
     1. CAROUSEL CONTROLLERS (Touch swipe, arrows, progress dots)
     -------------------------------------------------------------------------- */
  function initCarousels() {
    setupTrackCarousel({
      trackId: "catTrack",
      prevBtnId: "catPrev",
      nextBtnId: "catNext",
      dotsId: "catDots",
      itemSelector: ".cat-card",
      stepRatio: 0.85
    });

    setupTrackCarousel({
      trackId: "featured-track",
      prevBtnId: "featPrev",
      nextBtnId: "featNext",
      dotsId: "featDots",
      itemSelector: ".group",
      stepRatio: 0.85
    });

    setupTrackCarousel({
      trackId: "new-track",
      prevBtnId: "newPrev",
      nextBtnId: "newNext",
      dotsId: "newDots",
      itemSelector: ".group",
      stepRatio: 0.85
    });

    setupReviewsDots();
  }

  function setupTrackCarousel(config) {
    const track = document.getElementById(config.trackId);
    if (!track) return;

    const prevBtn = document.getElementById(config.prevBtnId);
    const nextBtn = document.getElementById(config.nextBtnId);
    const dotsContainer = document.getElementById(config.dotsId);

    function getStep() {
      const item = track.querySelector(config.itemSelector);
      if (!item) return 300;
      return (item.offsetWidth + 16) * (config.stepRatio || 1);
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

      const numDots = Math.min(items.length, 5);
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
          dot.className = "h-2 w-6 rounded-full bg-primary transition-all duration-300";
        } else {
          dot.className = "h-2 w-2 rounded-full bg-outline-variant/60 hover:bg-outline-variant transition-all duration-300";
        }
      });
    }

    let scrollTimeout;
    track.addEventListener("scroll", function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateDots, 60);
    }, { passive: true });

    setTimeout(updateDots, 150);
    window.addEventListener("resize", function () { setTimeout(updateDots, 100); }, { passive: true });
  }

  function setupReviewsDots() {
    const slider = document.getElementById("rvSlider");
    const dotsContainer = document.getElementById("rvDots");
    if (!slider || !dotsContainer) return;

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
            dot.className = "h-2 w-6 rounded-full bg-primary transition-all duration-300";
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

})();
