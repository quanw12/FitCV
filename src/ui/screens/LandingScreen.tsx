import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { useGSAP } from "@gsap/react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  ChartBar,
  CheckCircle,
  FileText,
  MagnifyingGlass,
  ShieldCheck,
  Sparkle,
  User,
} from "@phosphor-icons/react"
import BrandMark from "@/ui/components/BrandMark"

gsap.registerPlugin(useGSAP, ScrollTrigger)

const landingCss = `
  .fitcv-landing {
    --cine-bg: #08090d;
    --cine-bg-2: #0d1018;
    --cine-panel: #12161f;
    --cine-panel-2: #171c27;
    --cine-line: rgba(255,255,255,.08);
    --cine-line-2: rgba(255,255,255,.14);
    --cine-ink: #f4f6fb;
    --cine-soft: #b7c0d4;
    --cine-muted: #7b8598;
    --cine-blue: #4f7cff;
    --cine-blue-glow: rgba(79,124,255,.35);
    --cine-amber: #f0a752;
    --cine-amber-glow: rgba(240,167,82,.30);
    --cine-green: #5ed38b;
    min-height: 100vh;
    min-height: 100dvh;
    overflow-x: hidden;
    background: var(--cine-bg);
    color: var(--cine-ink);
    color-scheme: dark;
    font-family: var(--font-body, Geist, system-ui, sans-serif);
    line-height: 1.5;
    scroll-behavior: smooth;
  }
  .fitcv-landing *, .fitcv-landing *::before, .fitcv-landing *::after { box-sizing: border-box; }
  .fitcv-landing button { font: inherit; }
  .fitcv-landing button, .fitcv-landing a { -webkit-tap-highlight-color: transparent; }
  .fitcv-landing .lp-shell { width: min(1360px, calc(100% - 80px)); margin-inline: auto; }
  .fitcv-landing .lp-header {
    position: sticky;
    top: 0;
    z-index: 40;
    height: 72px;
    border-bottom: 1px solid transparent;
    background: transparent;
    transition: background .24s ease, border-color .24s ease, backdrop-filter .24s ease;
  }
  .fitcv-landing .lp-header.is-scrolled {
    border-color: var(--cine-line);
    background: rgba(8,9,13,.72);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  .fitcv-landing .lp-header-in { display: flex; height: 100%; align-items: center; justify-content: space-between; gap: 24px; }
  .fitcv-landing .lp-brand,
  .fitcv-landing .lp-nav button,
  .fitcv-landing .lp-text-button,
  .fitcv-landing .lp-link-button {
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .fitcv-landing .lp-brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    padding: 0;
    color: var(--cine-ink);
    font: 740 18px/1 var(--font-display, Geist, sans-serif);
    letter-spacing: -.055em;
  }
  .fitcv-landing .lp-brand-mark { display: grid; width: 30px; height: 30px; place-items: center; }
  .fitcv-landing .lp-brand-mark .fc-spider-mark,
  .fitcv-landing .lp-footer-brand .fc-spider-mark { filter: grayscale(1) contrast(300%) invert(1) brightness(1.12); }
  .fitcv-landing .lp-nav { display: flex; align-items: center; justify-content: center; gap: clamp(18px, 2.3vw, 34px); margin-inline: auto; }
  .fitcv-landing .lp-nav button,
  .fitcv-landing .lp-text-button {
    padding: 7px 0;
    color: var(--cine-muted);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .01em;
    transition: color .18s ease;
  }
  .fitcv-landing .lp-nav button:hover,
  .fitcv-landing .lp-text-button:hover { color: var(--cine-ink); }
  .fitcv-landing .lp-header-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 18px; }
  .fitcv-landing .lp-primary,
  .fitcv-landing .lp-secondary {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    border-radius: 9px;
    padding: 0 17px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 720;
    letter-spacing: .01em;
    white-space: nowrap;
    transition: transform .2s ease, background .2s ease, border-color .2s ease, color .2s ease, box-shadow .2s ease;
  }
  .fitcv-landing .lp-primary { border: 1px solid var(--cine-ink); background: var(--cine-ink); color: #090b10; }
  .fitcv-landing .lp-primary:hover { transform: translateY(-2px); background: #fff; box-shadow: 0 12px 30px -18px rgba(255,255,255,.8); }
  .fitcv-landing .lp-primary:active,
  .fitcv-landing .lp-secondary:active { transform: translateY(1px) scale(.98); }
  .fitcv-landing .lp-primary--blue { border-color: var(--cine-blue); background: var(--cine-blue); color: #071021; box-shadow: 0 14px 34px -20px var(--cine-blue-glow); }
  .fitcv-landing .lp-primary--blue:hover { background: #7094ff; box-shadow: 0 18px 40px -18px var(--cine-blue-glow); }
  .fitcv-landing .lp-secondary { border: 1px solid var(--cine-line-2); background: rgba(255,255,255,.02); color: var(--cine-ink); }
  .fitcv-landing .lp-secondary:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.32); background: rgba(255,255,255,.06); }
  .fitcv-landing .lp-brand:focus-visible,
  .fitcv-landing .lp-nav button:focus-visible,
  .fitcv-landing .lp-text-button:focus-visible,
  .fitcv-landing .lp-link-button:focus-visible,
  .fitcv-landing .lp-primary:focus-visible,
  .fitcv-landing .lp-secondary:focus-visible { outline: 2px solid var(--cine-blue); outline-offset: 4px; }

  .fitcv-landing .lp-hero {
    position: relative;
    min-height: 100vh;
    min-height: min(100dvh, 920px);
    overflow: hidden;
    background: var(--cine-bg);
    isolation: isolate;
  }
  .fitcv-landing .lp-hero::before {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    content: "";
    background: radial-gradient(circle at 72% 48%, rgba(79,124,255,.07), transparent 32%), radial-gradient(circle at 14% 88%, rgba(240,167,82,.055), transparent 26%), linear-gradient(180deg, transparent 65%, rgba(8,9,13,.8));
  }
  .fitcv-landing .lp-grain {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: .05;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
    mix-blend-mode: overlay;
  }
  .fitcv-landing .lp-orb { position: absolute; z-index: 0; width: 32vw; height: 32vw; border-radius: 50%; filter: blur(90px); pointer-events: none; opacity: .3; will-change: transform; }
  .fitcv-landing .lp-orb--blue { top: 13%; right: -11%; background: rgba(79,124,255,.16); }
  .fitcv-landing .lp-orb--amber { bottom: -16%; left: -11%; background: rgba(240,167,82,.11); }
  .fitcv-landing .lp-orb--small { top: 44%; left: 38%; width: 22vw; height: 22vw; background: rgba(79,124,255,.08); }
  .fitcv-landing .lp-particle-canvas { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; pointer-events: none; opacity: .56; }
  .fitcv-landing .lp-hero-grid { position: relative; z-index: 2; display: grid; min-height: 100vh; min-height: min(100dvh, 920px); grid-template-columns: minmax(0,1.12fr) minmax(380px,.88fr); align-items: center; gap: clamp(34px, 5vw, 70px); padding: 96px 0; }
  .fitcv-landing .lp-hero-copy { max-width: 780px; }
  .fitcv-landing .lp-eyebrow { display: inline-flex; align-items: center; gap: 10px; color: var(--cine-muted); font: 650 11px/1.2 var(--font-body, Geist, sans-serif); letter-spacing: .14em; text-transform: uppercase; }
  .fitcv-landing .lp-eyebrow::before { width: 26px; height: 1px; flex: 0 0 auto; background: currentColor; content: ""; opacity: .72; }
  .fitcv-landing .lp-eyebrow--hero { color: var(--cine-blue); }
  .fitcv-landing .lp-title,
  .fitcv-landing .lp-section-title,
  .fitcv-landing .lp-story-copy h2,
  .fitcv-landing .lp-cta-copy h2 { font-family: var(--font-serif, Georgia, serif); font-variation-settings: "opsz" 72; font-weight: 420; letter-spacing: -.025em; }
  .fitcv-landing .lp-title { max-width: 100%; margin: 24px 0 0; color: var(--cine-ink); font-size: clamp(44px, 5.2vw, 86px); line-height: .94; }
  .fitcv-landing .lp-line { display: block; overflow: hidden; padding: 0 .14em .16em; margin: 0 -.14em -.16em; }
  .fitcv-landing .lp-line > span { display: block; }
  .fitcv-landing .lp-title em,
  .fitcv-landing .lp-section-title em,
  .fitcv-landing .lp-story-copy h2 em,
  .fitcv-landing .lp-cta-copy h2 em { color: #fff; font-style: italic; font-weight: 420; text-shadow: 0 0 34px rgba(255,255,255,.18); }
  .fitcv-landing .lp-title em { padding-bottom: .1em; }
  .fitcv-landing .lp-subtitle { max-width: 560px; margin: 27px 0 0; color: var(--cine-soft); font-size: clamp(16px, 1.05vw, 19px); line-height: 1.68; }
  .fitcv-landing .lp-hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
  .fitcv-landing .lp-hero-actions .lp-primary,
  .fitcv-landing .lp-hero-actions .lp-secondary { min-height: 52px; padding: 0 24px; font-size: 13px; }
  .fitcv-landing .lp-hero-proof { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px 30px; max-width: 640px; margin-top: 38px; padding-top: 22px; border-top: 1px solid var(--cine-line); }
  .fitcv-landing .lp-hero-proof div { display: grid; gap: 6px; align-content: start; }
  .fitcv-landing .lp-hero-proof strong { color: var(--cine-ink); font: 700 13px/1.2 var(--font-body, Geist, sans-serif); letter-spacing: -.01em; }
  .fitcv-landing .lp-hero-proof span { color: var(--cine-muted); font: 12px/1.45 var(--font-body, Geist, sans-serif); }
  .fitcv-landing .lp-scroll-cue { position: absolute; bottom: 28px; left: 50%; z-index: 3; display: grid; justify-items: center; gap: 10px; color: var(--cine-muted); font: 650 11px/1 var(--font-body, Geist, sans-serif); letter-spacing: .22em; transform: translateX(-50%); }
  .fitcv-landing .lp-scroll-line { display: block; width: 1px; height: 35px; overflow: hidden; background: var(--cine-line-2); }
  .fitcv-landing .lp-scroll-line::after { display: block; width: 100%; height: 42%; background: var(--cine-ink); content: ""; animation: fitcvLandingScroll 2.1s ease-in-out infinite; }

  .fitcv-landing .lp-match-wrap { position: relative; width: min(100%, 620px); margin-left: auto; perspective: 1200px; }
  .fitcv-landing .lp-match-card { position: relative; z-index: 2; overflow: hidden; border: 1px solid var(--cine-line-2); border-radius: 18px; background: linear-gradient(145deg, rgba(23,28,39,.96), rgba(13,16,24,.98)); box-shadow: 0 34px 90px -45px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.07); will-change: transform; }
  .fitcv-landing .lp-match-card::before { position: absolute; inset: 0; pointer-events: none; content: ""; background: radial-gradient(circle at 16% 0%, rgba(255,255,255,.08), transparent 32%), radial-gradient(circle at 100% 100%, rgba(79,124,255,.08), transparent 36%); }
  .fitcv-landing .lp-match-top { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--cine-line); padding: 18px 21px; }
  .fitcv-landing .lp-match-brand, .fitcv-landing .lp-candidate { display: flex; align-items: center; gap: 10px; }
  .fitcv-landing .lp-match-brand strong, .fitcv-landing .lp-candidate strong { display: block; color: var(--cine-ink); font-size: 12px; line-height: 1.2; }
  .fitcv-landing .lp-match-brand small, .fitcv-landing .lp-candidate small { display: block; margin-top: 4px; color: var(--cine-muted); font-size: 12px; }
  .fitcv-landing .lp-match-icon { display: grid; width: 29px; height: 29px; place-items: center; border: 1px solid rgba(79,124,255,.4); border-radius: 9px; color: var(--cine-blue); background: rgba(79,124,255,.12); }
  .fitcv-landing .lp-ready { border: 1px solid rgba(94,211,139,.22); border-radius: 99px; padding: 6px 9px; color: var(--cine-green); background: rgba(94,211,139,.08); font: 700 11px/1 var(--font-body, Geist, sans-serif); white-space: nowrap; }
  .fitcv-landing .lp-match-body { position: relative; display: grid; grid-template-columns: 1.04fr .96fr; gap: 14px; padding: 14px; }
  .fitcv-landing .lp-match-pane { min-width: 0; border: 1px solid var(--cine-line); border-radius: 13px; background: rgba(255,255,255,.025); padding: 20px; }
  .fitcv-landing .lp-candidate-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .fitcv-landing .lp-avatar { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid rgba(79,124,255,.34); border-radius: 50%; color: var(--cine-blue); background: rgba(79,124,255,.1); }
  .fitcv-landing .lp-open-icon { color: var(--cine-muted); }
  .fitcv-landing .lp-meter-block { margin-top: 25px; }
  .fitcv-landing .lp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .fitcv-landing .lp-row label, .fitcv-landing .lp-row span { color: var(--cine-muted); font-size: 12px; }
  .fitcv-landing .lp-row span { color: var(--cine-ink); font-weight: 700; }
  .fitcv-landing .lp-progress { height: 5px; margin-top: 9px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.1); }
  .fitcv-landing .lp-progress-fill { display: block; width: 82%; height: 100%; border-radius: inherit; background: var(--cine-blue); box-shadow: 0 0 18px var(--cine-blue-glow); transform: scaleX(1); transform-origin: left center; }
  .fitcv-landing .lp-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 17px; }
  .fitcv-landing .lp-chips span { border: 1px solid var(--cine-line); border-radius: 5px; padding: 5px 7px; color: var(--cine-soft); background: rgba(255,255,255,.035); font: 600 12px/1.2 var(--font-body, Geist, sans-serif); }
  .fitcv-landing .lp-chips span:last-child { border-color: rgba(79,124,255,.28); color: #a9baff; background: rgba(79,124,255,.1); }
  .fitcv-landing .lp-review-note { margin-top: 16px; border: 1px solid rgba(240,167,82,.28); border-radius: 9px; padding: 9px 10px; color: #d9b57f; background: rgba(240,167,82,.07); font-size: 13px; line-height: 1.45; }
  .fitcv-landing .lp-review-note b { color: var(--cine-amber); }
  .fitcv-landing .lp-evidence-pane { border-color: rgba(255,255,255,.12); background: #0a0d14; color: var(--cine-ink); }
  .fitcv-landing .lp-evidence-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .fitcv-landing .lp-evidence-head strong { display: block; color: var(--cine-ink); font-size: 12px; }
  .fitcv-landing .lp-evidence-head small { display: block; max-width: 140px; margin-top: 4px; color: var(--cine-muted); font-size: 12px; line-height: 1.35; }
  .fitcv-landing .lp-score { color: var(--cine-ink); font: 650 34px/1 var(--font-body, Geist, sans-serif); font-variant-numeric: tabular-nums; letter-spacing: -.07em; }
  .fitcv-landing .lp-score small { display: inline; margin-left: 2px; color: var(--cine-muted); font-size: 12px; letter-spacing: 0; }
  .fitcv-landing .lp-evidence-list { display: grid; gap: 0; margin-top: 21px; }
  .fitcv-landing .lp-evidence-line { display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid rgba(255,255,255,.09); padding: 10px 0; color: var(--cine-soft); font-size: 13px; }
  .fitcv-landing .lp-evidence-line:last-child { border-bottom: 0; }
  .fitcv-landing .lp-evidence-line b { display: inline-flex; align-items: center; gap: 6px; color: var(--cine-ink); font-size: 13px; }
  .fitcv-landing .lp-state-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--cine-blue); }
  .fitcv-landing .lp-state-dot--amber { background: var(--cine-amber); }
  .fitcv-landing .lp-state-dot--green { background: var(--cine-green); }
  .fitcv-landing .lp-source { display: flex; align-items: center; gap: 6px; margin-top: 15px; color: var(--cine-green); font-size: 12px; }
  .fitcv-landing .lp-clear-chip { position: absolute; right: -27px; bottom: -22px; z-index: 3; display: grid; gap: 4px; border: 1px solid rgba(255,255,255,.16); border-radius: 10px; background: rgba(18,22,31,.94); padding: 11px 13px; box-shadow: 0 18px 44px -24px rgba(0,0,0,.9); will-change: transform; }
  .fitcv-landing .lp-clear-chip strong { color: var(--cine-ink); font-size: 12px; }
  .fitcv-landing .lp-clear-chip span { color: var(--cine-muted); font-size: 12px; }

  .fitcv-landing .lp-rail { overflow: hidden; border-top: 1px solid var(--cine-line); border-bottom: 1px solid var(--cine-line); background: var(--cine-bg-2); }
  .fitcv-landing .lp-marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
  .fitcv-landing .lp-marquee-track { display: flex; width: max-content; animation: fitcvLandingMarquee 38s linear infinite; }
  .fitcv-landing .lp-marquee:hover .lp-marquee-track { animation-play-state: paused; }
  .fitcv-landing .lp-marquee-set { display: flex; align-items: center; gap: 27px; min-height: 58px; padding-right: 27px; }
  .fitcv-landing .lp-rail-item { display: inline-flex; align-items: center; gap: 27px; color: var(--cine-muted); font: 650 11px/1.3 var(--font-body, Geist, sans-serif); letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
  .fitcv-landing .lp-rail-item::after { width: 4px; height: 4px; border-radius: 50%; background: var(--cine-blue); content: ""; opacity: .8; }

  .fitcv-landing .lp-section { padding: clamp(96px,10vw,160px) 0; background: var(--cine-bg); }
  .fitcv-landing .lp-section .lp-section-heading { display: grid; grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr); gap: clamp(32px,5vw,80px); align-items: end; max-width: none; }
  .fitcv-landing .lp-section .lp-section-heading .lp-eyebrow { grid-column: 1; }
  .fitcv-landing .lp-section .lp-section-heading .lp-section-title { grid-column: 1; }
  .fitcv-landing .lp-section .lp-section-heading .lp-section-copy { grid-column: 2; grid-row: 1 / span 2; align-self: end; }
  .fitcv-landing .lp-section-title { max-width: 100%; margin: 20px 0 0; color: var(--cine-ink); font-size: clamp(34px,3.8vw,56px); line-height: 1.04; }
  .fitcv-landing .lp-section-title em,
  .fitcv-landing .lp-story-copy h2 em,
  .fitcv-landing .lp-cta-copy h2 em { padding-bottom: .08em; }
  .fitcv-landing .lp-section-copy { max-width: 650px; margin: 22px 0 0; color: var(--cine-soft); font-size: 16px; line-height: 1.68; }
  .fitcv-landing .lp-workflows { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; margin-top: 55px; }
  .fitcv-landing .lp-workflow { position: relative; display: flex; flex-direction: column; min-height: 400px; overflow: hidden; border: 1px solid var(--cine-line); border-radius: 16px; background: linear-gradient(145deg, rgba(255,255,255,.035), rgba(255,255,255,.012)); padding: 30px; transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease, background .25s ease; }
  .fitcv-landing .lp-workflow::after { position: absolute; right: -48px; bottom: -90px; width: 190px; height: 190px; border-radius: 50%; background: var(--cine-blue-glow); content: ""; opacity: 0; filter: blur(42px); transition: opacity .3s ease; }
  .fitcv-landing .lp-workflow--amber::after { background: var(--cine-amber-glow); }
  .fitcv-landing .lp-workflow:hover { transform: translateY(-4px); border-color: rgba(79,124,255,.58); background: linear-gradient(145deg, rgba(79,124,255,.08), rgba(255,255,255,.02)); box-shadow: 0 28px 58px -42px var(--cine-blue-glow); }
  .fitcv-landing .lp-workflow--amber:hover { border-color: rgba(240,167,82,.58); background: linear-gradient(145deg, rgba(240,167,82,.08), rgba(255,255,255,.02)); box-shadow: 0 28px 58px -42px var(--cine-amber-glow); }
  .fitcv-landing .lp-workflow:hover::after { opacity: .8; }
  .fitcv-landing .lp-workflow-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .fitcv-landing .lp-workflow-icon { display: grid; width: 43px; height: 43px; place-items: center; border: 1px solid rgba(79,124,255,.35); border-radius: 11px; color: var(--cine-blue); background: rgba(79,124,255,.1); }
  .fitcv-landing .lp-workflow--amber .lp-workflow-icon { border-color: rgba(240,167,82,.35); color: var(--cine-amber); background: rgba(240,167,82,.1); }
  .fitcv-landing .lp-workflow-label { color: var(--cine-blue); font: 700 11px/1.2 var(--font-body, Geist, sans-serif); letter-spacing: .14em; text-transform: uppercase; }
  .fitcv-landing .lp-workflow--amber .lp-workflow-label { color: var(--cine-amber); }
  .fitcv-landing .lp-workflow h3 { position: relative; z-index: 1; max-width: 22ch; margin: 40px 0 0; color: var(--cine-ink); font: 420 clamp(24px,2.2vw,32px)/1.06 var(--font-serif, Georgia, serif); letter-spacing: -.025em; }
  .fitcv-landing .lp-workflow p { position: relative; z-index: 1; max-width: 520px; margin: 16px 0 0; color: var(--cine-soft); font-size: 14px; line-height: 1.65; }
  .fitcv-landing .lp-workflow ol { position: relative; z-index: 1; display: grid; gap: 13px; margin: auto 0 0; padding: 24px 0 0; border-top: 1px solid var(--cine-line); list-style: none; }
  .fitcv-landing .lp-workflow li { display: grid; grid-template-columns: 26px minmax(0,1fr); gap: 9px; color: var(--cine-soft); font-size: 13px; line-height: 1.45; }
  .fitcv-landing .lp-workflow li b { color: var(--cine-blue); font: 700 11px/1 var(--font-body, Geist, sans-serif); letter-spacing: .08em; }
  .fitcv-landing .lp-workflow--amber li b { color: var(--cine-amber); }

  .fitcv-landing .lp-story { min-height: 100vh; min-height: 100dvh; overflow: hidden; scroll-margin-top: 72px; background: var(--cine-bg-2); }
  .fitcv-landing .lp-story-grid { display: grid; min-height: 100vh; min-height: 100dvh; grid-template-columns: minmax(0,.84fr) minmax(0,1.16fr); align-items: center; gap: clamp(42px, 7vw, 100px); padding: 90px 0; }
  .fitcv-landing .lp-story-copy { position: relative; z-index: 2; }
  .fitcv-landing .lp-story-copy h2 { max-width: 100%; margin: 20px 0 0; color: var(--cine-ink); font-size: clamp(32px,3.4vw,50px); line-height: 1.04; }
  .fitcv-landing .lp-story-copy p { max-width: 455px; margin: 23px 0 0; color: var(--cine-soft); font-size: 15px; line-height: 1.7; }
  .fitcv-landing .lp-story-steps { display: grid; gap: 8px; margin-top: 39px; }
  .fitcv-landing .lp-story-step { display: grid; grid-template-columns: 30px minmax(0,1fr); gap: 11px; align-items: center; border: 1px solid transparent; border-radius: 10px; padding: 10px 11px; color: var(--cine-muted); font-size: 12px; line-height: 1.35; transition: color .24s ease, background .24s ease, border-color .24s ease; }
  .fitcv-landing .lp-story-step b { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 50%; color: var(--cine-blue); background: rgba(79,124,255,.11); font: 700 11px/1 var(--font-body, Geist, sans-serif); }
  .fitcv-landing .lp-story-step.is-active { border-color: rgba(79,124,255,.32); color: var(--cine-ink); background: rgba(255,255,255,.045); }
  .fitcv-landing .lp-story-stage { position: relative; min-height: clamp(460px, 52vh, 560px); perspective: 1200px; }
  .fitcv-landing .lp-story-stage::before { position: absolute; inset: 7% 2% 2%; border: 1px solid var(--cine-line); border-radius: 24px; background: radial-gradient(circle at 78% 14%, rgba(79,124,255,.14), transparent 30%), rgba(255,255,255,.02); content: ""; transform: rotate(2.5deg); }
  .fitcv-landing .lp-story-panels { position: absolute; inset: 0; z-index: 1; }
  .fitcv-landing .lp-story-panel { position: absolute; inset: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--cine-line-2); border-radius: 17px; background: var(--cine-panel); box-shadow: 0 32px 80px -48px rgba(0,0,0,.95), inset 0 1px 0 rgba(255,255,255,.06); opacity: 0; visibility: hidden; }
  .fitcv-landing .lp-story-panel:first-child { opacity: 1; visibility: visible; }
  .fitcv-landing .lp-story-panel--amber { border-color: rgba(240,167,82,.32); }
  .fitcv-landing .lp-story-panel-top { display: flex; align-items: center; justify-content: space-between; gap: 14px; border-bottom: 1px solid var(--cine-line); padding: 18px 20px; }
  .fitcv-landing .lp-story-panel-title { display: inline-flex; align-items: center; gap: 9px; color: var(--cine-ink); font-size: 12px; font-weight: 720; }
  .fitcv-landing .lp-story-panel-title svg { color: var(--cine-blue); }
  .fitcv-landing .lp-story-panel--amber .lp-story-panel-title svg { color: var(--cine-amber); }
  .fitcv-landing .lp-story-status { border: 1px solid rgba(94,211,139,.2); border-radius: 99px; padding: 6px 9px; color: var(--cine-green); background: rgba(94,211,139,.08); font: 700 11px/1 var(--font-body, Geist, sans-serif); }
  .fitcv-landing .lp-story-panel-body { display: grid; flex: 1; grid-template-columns: 1.08fr .92fr; gap: 14px; padding: 14px; background: rgba(255,255,255,.018); }
  .fitcv-landing .lp-story-pane { display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--cine-line); border-radius: 12px; background: rgba(255,255,255,.025); padding: 19px; }
  .fitcv-landing .lp-story-pane--dark { border-color: rgba(255,255,255,.12); background: #0a0d14; }
  .fitcv-landing .lp-story-pane h3 { margin: 0; color: var(--cine-ink); font: 420 20px/1.12 var(--font-serif, Georgia, serif); letter-spacing: -.02em; }
  .fitcv-landing .lp-story-pane p { margin: 11px 0 0; color: var(--cine-soft); font-size: 14px; line-height: 1.58; }
  .fitcv-landing .lp-story-meter { height: 5px; margin-top: 27px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.1); }
  .fitcv-landing .lp-story-meter i { display: block; width: 82%; height: 100%; border-radius: inherit; background: var(--cine-blue); }
  .fitcv-landing .lp-story-checks { display: grid; gap: 12px; margin-top: 23px; }
  .fitcv-landing .lp-story-check { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--cine-soft); font-size: 13px; }
  .fitcv-landing .lp-story-check b { display: inline-flex; align-items: center; gap: 5px; color: var(--cine-green); font-size: 13px; white-space: nowrap; }
  .fitcv-landing .lp-story-check--optional { color: var(--cine-muted) !important; font-weight: 500; }
  .fitcv-landing .lp-story-detected { margin-top: 24px; }
  .fitcv-landing .lp-story-micro { display: block; color: var(--cine-muted); font: 650 11px/1.2 var(--font-body, Geist, sans-serif); letter-spacing: .14em; text-transform: uppercase; }
  .fitcv-landing .lp-story-chips { gap: 6px; margin-top: 9px; }
  .fitcv-landing .lp-story-chips span { font-size: 13px; }
  .fitcv-landing .lp-evidence-strength { display: grid; align-content: start; gap: 14px; margin-top: 24px; }
  .fitcv-landing .lp-strength-row { display: grid; grid-template-columns: minmax(0,1.1fr) minmax(72px,1fr) 30px; align-items: center; gap: 10px; color: var(--cine-soft); font-size: 13px; }
  .fitcv-landing .lp-strength-bar { height: 4px; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.1); }
  .fitcv-landing .lp-strength-bar i { display: block; width: var(--strength); height: 100%; border-radius: inherit; background: var(--cine-blue); transform-origin: left center; }
  .fitcv-landing .lp-strength-row--amber .lp-strength-bar i { background: var(--cine-amber); }
  .fitcv-landing .lp-strength-value { color: var(--cine-ink); font-variant-numeric: tabular-nums; text-align: right; }
  .fitcv-landing .lp-review-trail { display: grid; align-content: start; gap: 14px; margin-top: 24px; }
  .fitcv-landing .lp-review-trail-item { display: flex; align-items: center; gap: 10px; color: var(--cine-soft); font-size: 13px; }
  .fitcv-landing .lp-review-trail-item::before { width: 8px; height: 8px; flex: 0 0 auto; border: 1px solid rgba(94,211,139,.7); border-radius: 50%; background: var(--cine-green); content: ""; }
  .fitcv-landing .lp-review-trail-item--pending { color: var(--cine-amber); }
  .fitcv-landing .lp-review-trail-item--pending::before { border-color: var(--cine-amber); background: transparent; }
  .fitcv-landing .lp-story-score { margin-top: 22px; color: var(--cine-ink); font: 520 69px/.9 var(--font-body, Geist, sans-serif); font-variant-numeric: tabular-nums; letter-spacing: -.08em; }
  .fitcv-landing .lp-story-score small { margin-left: 4px; color: var(--cine-muted); font-size: 13px; letter-spacing: 0; }
  .fitcv-landing .lp-story-evidence { display: grid; gap: 0; margin-top: 24px; }
  .fitcv-landing .lp-story-evidence div { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid rgba(255,255,255,.09); padding: 12px 0; color: var(--cine-soft); font-size: 13px; }
  .fitcv-landing .lp-story-evidence div:last-child { border-bottom: 0; }
  .fitcv-landing .lp-story-evidence b { color: var(--cine-ink); }
  .fitcv-landing .lp-story-message { margin-top: auto; border: 1px solid rgba(240,167,82,.3); border-radius: 9px; padding: 11px; color: #d7b57e; background: rgba(240,167,82,.07); font-size: 13px; line-height: 1.5; }
  .fitcv-landing .lp-story-message b { color: var(--cine-amber); }

  .fitcv-landing .lp-principles-section { padding: clamp(96px,10vw,160px) 0; background: var(--cine-bg); }
  .fitcv-landing .lp-principles-grid { display: grid; grid-template-columns: minmax(0,.88fr) minmax(0,1.12fr); align-items: start; gap: clamp(42px, 7vw, 100px); }
  .fitcv-landing .lp-principles-grid .lp-section-heading { position: sticky; top: 104px; }
  .fitcv-landing .lp-principles-grid .lp-section-title { max-width: 410px; font-size: clamp(32px,3.4vw,50px); }
  .fitcv-landing .lp-principles-list { display: grid; grid-template-columns: minmax(0,1fr); gap: 16px; }
  .fitcv-landing .lp-principle { min-height: auto; border: 1px solid var(--cine-line); background: rgba(255,255,255,.025); padding: 24px 26px; transition: transform .22s ease, border-color .22s ease, background .22s ease; }
  .fitcv-landing .lp-principle:first-child { grid-row: auto; }
  .fitcv-landing .lp-principle:hover { border-color: var(--cine-line-2); background: rgba(255,255,255,.055); transform: translateY(-3px); }
  .fitcv-landing .lp-principle-icon { display: grid; width: 37px; height: 37px; place-items: center; border: 1px solid var(--cine-line-2); border-radius: 10px; color: var(--cine-blue); background: rgba(79,124,255,.08); }
  .fitcv-landing .lp-principle-index { display: block; margin: 31px 0 13px; color: var(--cine-muted); font: 700 11px/1 var(--font-body, Geist, sans-serif); letter-spacing: .14em; }
  .fitcv-landing .lp-principle h3 { margin: 0; color: var(--cine-ink); font: 420 clamp(24px,2.2vw,32px)/1.08 var(--font-serif, Georgia, serif); letter-spacing: -.02em; }
  .fitcv-landing .lp-principle p { margin: 12px 0 0; color: var(--cine-soft); font-size: 15px; line-height: 1.58; }

  .fitcv-landing .lp-cta { padding: clamp(96px,10vw,160px) 0; background: var(--cine-bg-2); }
  .fitcv-landing .lp-cta-box { display: grid; grid-template-columns: minmax(0,1.16fr) minmax(330px,.84fr); overflow: hidden; border: 1px solid var(--cine-line-2); border-radius: 17px; background: var(--cine-panel); }
  .fitcv-landing .lp-cta-copy { padding: clamp(31px, 5vw, 65px); }
  .fitcv-landing .lp-cta-copy h2 { max-width: 100%; margin: 20px 0 0; color: var(--cine-ink); font-size: clamp(34px,3.8vw,56px); line-height: 1.04; }
  .fitcv-landing .lp-cta-copy p { max-width: 575px; margin: 23px 0 0; color: var(--cine-soft); font-size: 15px; line-height: 1.68; }
  .fitcv-landing .lp-cta-copy .lp-primary { margin-top: 30px; }
  .fitcv-landing .lp-cta-note { margin: 13px 0 0; color: var(--cine-muted); font-size: 13px; }
  .fitcv-landing .lp-cta-art { position: relative; display: flex; min-height: 340px; align-items: center; justify-content: center; overflow: hidden; border-left: 1px solid var(--cine-line); background: radial-gradient(circle at 50% 45%, rgba(79,124,255,.17), transparent 32%), #0a0d14; padding: 44px; }
  .fitcv-landing .lp-cta-orb { position: absolute; top: -90px; right: -70px; width: 340px; height: 340px; border-radius: 50%; background: rgba(79,124,255,.26); filter: blur(96px); opacity: .5; }
  .fitcv-landing .lp-cta-orb--amber { top: auto; right: auto; bottom: -95px; left: -75px; width: 200px; height: 200px; background: rgba(240,167,82,.16); filter: blur(80px); }
  .fitcv-landing .lp-ready-card { position: relative; z-index: 1; width: min(270px,100%); border: 1px solid rgba(255,255,255,.16); border-radius: 13px; background: rgba(18,22,31,.88); padding: 23px; box-shadow: 0 25px 60px -35px rgba(0,0,0,.92); }
  .fitcv-landing .lp-ready-card > svg { color: var(--cine-blue); }
  .fitcv-landing .lp-ready-card h3 { margin: 20px 0 0; color: var(--cine-ink); font: 420 26px/1 var(--font-serif, Georgia, serif); }
  .fitcv-landing .lp-ready-card p { margin: 10px 0 0; color: var(--cine-soft); font-size: 15px; line-height: 1.55; }
  .fitcv-landing .lp-ready-card span { display: flex; align-items: center; gap: 6px; margin-top: 21px; color: var(--cine-green); font-size: 13px; }
  .fitcv-landing .lp-footer { border-top: 1px solid var(--cine-line); background: var(--cine-bg-2); padding: 31px 0; }
  .fitcv-landing .lp-footer-in { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 18px 24px; color: var(--cine-muted); font-size: 13px; }
  .fitcv-landing .lp-footer-main { display: flex; align-items: center; gap: 28px; min-width: 0; }
  .fitcv-landing .lp-footer-brand { display: inline-flex; align-items: center; gap: 7px; color: var(--cine-ink); font: 720 16px/1 var(--font-display, Geist, sans-serif); letter-spacing: -.045em; }
  .fitcv-landing .lp-footer-brand i { display: grid; width: 23px; height: 23px; place-items: center; }
  .fitcv-landing .lp-link-button { padding: 6px 0; color: var(--cine-ink); font-size: 13px; font-weight: 700; }
  .fitcv-landing .lp-footer-in small { grid-column: 1 / -1; border-top: 1px solid var(--cine-line); padding-top: 16px; color: var(--cine-muted); font-size: 12px; }
  .fitcv-landing .lp-link-button:hover { color: var(--cine-blue); }

  @keyframes fitcvLandingMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  @keyframes fitcvLandingScroll { 0% { transform: translateY(-120%); } 55%, 100% { transform: translateY(260%); } }

  @media (max-width: 1080px) {
    .fitcv-landing .lp-hero-grid { grid-template-columns: minmax(0,1fr) minmax(400px,1fr); gap: 30px; }
    .fitcv-landing .lp-title { font-size: clamp(44px, 5.4vw, 64px); }
    .fitcv-landing .lp-nav { gap: 17px; }
  }
  @media (max-width: 920px) {
    .fitcv-landing .lp-nav { display: none; }
    .fitcv-landing .lp-hero { min-height: auto; }
    .fitcv-landing .lp-hero-grid { min-height: auto; }
    .fitcv-landing .lp-principles-grid .lp-section-heading { position: static; top: auto; }
    .fitcv-landing .lp-hero-proof { max-width: 680px; }
    .fitcv-landing .lp-hero-grid,
    .fitcv-landing .lp-story-grid,
    .fitcv-landing .lp-principles-grid,
    .fitcv-landing .lp-cta-box { grid-template-columns: 1fr; }
    .fitcv-landing .lp-hero-grid { gap: 62px; padding-top: 79px; }
    .fitcv-landing .lp-match-wrap { max-width: 680px; }
    .fitcv-landing .lp-story { min-height: auto; }
    .fitcv-landing .lp-story-grid { min-height: auto; gap: 45px; padding: 104px 0 124px; }
    .fitcv-landing .lp-story-stage { min-height: 0; }
    .fitcv-landing .lp-story-panels { position: relative; display: grid; gap: 18px; }
    .fitcv-landing .lp-story-panel { position: relative; inset: auto; min-height: 470px; opacity: 1; visibility: visible; }
    .fitcv-landing .lp-section .lp-section-heading { display: block; }
    .fitcv-landing .lp-section .lp-section-heading .lp-section-copy { margin-top: 22px; }
    .fitcv-landing .lp-principles-list { max-width: 760px; }
    .fitcv-landing .lp-cta-art { min-height: 300px; border-top: 1px solid var(--cine-line); border-left: 0; }
  }
  @media (max-width: 680px) {
    .fitcv-landing .lp-shell { width: min(100% - 32px, 1200px); }
    .fitcv-landing .lp-header { height: 64px; }
    .fitcv-landing .lp-text-button { display: none; }
    .fitcv-landing .lp-header-actions { gap: 0; }
    .fitcv-landing .lp-header .lp-primary { min-height: 38px; padding-inline: 13px; font-size: 11px; }
    .fitcv-landing .lp-hero-grid { gap: 55px; padding: 58px 0 100px; }
    .fitcv-landing .lp-title { font-size: clamp(42px, 12vw, 62px); }
    .fitcv-landing .lp-subtitle { font-size: 15px; }
    .fitcv-landing .lp-hero-proof { grid-template-columns: 1fr; gap: 16px; margin-top: 32px; padding-top: 20px; }
    .fitcv-landing .lp-hero-actions { align-items: stretch; flex-direction: column; }
    .fitcv-landing .lp-hero-actions .lp-primary,
    .fitcv-landing .lp-hero-actions .lp-secondary { width: 100%; }
    .fitcv-landing .lp-particle-canvas { display: none; }
    .fitcv-landing .lp-scroll-cue { bottom: 23px; }
    .fitcv-landing .lp-orb { width: 58vw; height: 58vw; }
    .fitcv-landing .lp-match-body { grid-template-columns: 1fr; }
    .fitcv-landing .lp-evidence-pane { display: none; }
    .fitcv-landing .lp-clear-chip { right: 10px; bottom: -20px; }
    .fitcv-landing .lp-marquee-set { min-height: 76px; flex-wrap: wrap; gap: 12px 22px; padding-block: 14px; }
    .fitcv-landing .lp-rail-item { gap: 22px; font-size: 11px; }
    .fitcv-landing .lp-section,
    .fitcv-landing .lp-principles-section,
    .fitcv-landing .lp-cta { padding: 86px 0; }
    .fitcv-landing .lp-section-title { font-size: clamp(42px, 12vw, 59px); }
    .fitcv-landing .lp-workflows { grid-template-columns: 1fr; margin-top: 39px; }
    .fitcv-landing .lp-workflow { min-height: 0; padding: 25px; }
    .fitcv-landing .lp-workflow h3 { margin-top: 40px; font-size: 32px; }
    .fitcv-landing .lp-story-grid { gap: 37px; padding: 86px 0 100px; }
    .fitcv-landing .lp-story-copy h2 { font-size: clamp(43px, 12vw, 60px); }
    .fitcv-landing .lp-story-panel { min-height: 0; }
    .fitcv-landing .lp-story-panel-body { grid-template-columns: 1fr; }
    .fitcv-landing .lp-story-pane--dark { min-height: 190px; }
    .fitcv-landing .lp-principles-list { grid-template-columns: 1fr; grid-template-rows: auto; }
    .fitcv-landing .lp-principle:first-child { grid-row: auto; }
    .fitcv-landing .lp-principle-index { margin-top: 31px; }
    .fitcv-landing .lp-cta-copy { padding: 31px 25px; }
    .fitcv-landing .lp-cta-copy h2 { font-size: clamp(43px, 12vw, 60px); }
    .fitcv-landing .lp-cta-art { min-height: 250px; padding: 31px 25px; }
    .fitcv-landing .lp-footer-in { display: flex; align-items: flex-start; flex-direction: column; gap: 15px; }
    .fitcv-landing .lp-footer-main { align-items: flex-start; flex-direction: column; gap: 11px; }
    .fitcv-landing .lp-footer-in small { width: 100%; padding-top: 14px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .fitcv-landing { scroll-behavior: auto; }
    .fitcv-landing *, .fitcv-landing *::before, .fitcv-landing *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; }
    .fitcv-landing .lp-line > span,
    .fitcv-landing .lp-progress-fill { transform: none !important; }
    .fitcv-landing .lp-story-stage { min-height: 0; }
    .fitcv-landing .lp-story-panels { position: relative; display: grid; gap: 18px; }
    .fitcv-landing .lp-story-panel { position: relative; inset: auto; min-height: 0; opacity: 1 !important; visibility: visible !important; transform: none !important; }
    .fitcv-landing .lp-marquee-track { width: 100%; animation: none !important; }
    .fitcv-landing .lp-marquee-set { width: 50%; flex-wrap: wrap; }
  }
`

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (
      !canvas ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return

    const context = canvas.getContext("2d")
    if (!context) return

    let animationFrame: number | null = null
    let particles: Particle[] = []

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(bounds.width * ratio))
      canvas.height = Math.max(1, Math.floor(bounds.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      particles = Array.from({ length: 60 }, () => ({
        x: Math.random() * bounds.width,
        y: Math.random() * bounds.height,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        radius: Math.random() * 1.3 + 0.35,
        alpha: Math.random() * 0.38 + 0.12,
      }))
    }

    const draw = () => {
      if (document.hidden) {
        animationFrame = null
        return
      }

      const bounds = canvas.getBoundingClientRect()
      context.clearRect(0, 0, bounds.width, bounds.height)
      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy
        if (particle.x < -10) particle.x = bounds.width + 10
        if (particle.x > bounds.width + 10) particle.x = -10
        if (particle.y < -10) particle.y = bounds.height + 10
        if (particle.y > bounds.height + 10) particle.y = -10
        context.beginPath()
        context.fillStyle = `rgba(177, 196, 255, ${particle.alpha})`
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
        context.fill()
      })

      for (let index = 0; index < particles.length; index += 1) {
        for (
          let nextIndex = index + 1;
          nextIndex < particles.length;
          nextIndex += 1
        ) {
          const first = particles[index]
          const second = particles[nextIndex]
          if (!first || !second) continue
          const distance = Math.hypot(first.x - second.x, first.y - second.y)
          if (distance > 128) continue
          context.beginPath()
          context.strokeStyle = `rgba(111, 139, 218, ${0.12 * (1 - distance / 128)})`
          context.lineWidth = 0.5
          context.moveTo(first.x, first.y)
          context.lineTo(second.x, second.y)
          context.stroke()
        }
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    const handleVisibility = () => {
      if (document.hidden) {
        if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
        animationFrame = null
      } else if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    resize()
    draw()
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="lp-particle-canvas" aria-hidden="true" />
  )
}

function Workflow({
  accent,
  icon,
  label,
  title,
  copy,
  steps,
}: {
  accent?: "amber"
  icon: ReactNode
  label: string
  title: string
  copy: string
  steps: readonly string[]
}) {
  return (
    <article
      className={`lp-workflow ${
        accent === "amber" ? "lp-workflow--amber" : ""
      }`}
    >
      <div className="lp-workflow-top">
        <span className="lp-workflow-icon">{icon}</span>
        <span className="lp-workflow-label">{label}</span>
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <ol>
        {steps.map((step, index) => (
          <li key={step}>
            <b>0{index + 1}</b>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </article>
  )
}

const seekerSteps = [
  "Upload the CV you already have",
  "Paste a role you want to pursue",
  "Read the evidence, the gaps, and the next step",
] as const
const hiringSteps = [
  "Bring a job description or screening criteria",
  "Read CV evidence beside every score",
  "Shortlist deliberately, with a clear trail",
] as const
const trustItems = [
  "Source-grounded review",
  "Evidence beside every score",
  "Two portals, one engine",
  "Never auto-accepts or rejects",
  "PDF and DOCX",
  "Built for review, not verdicts",
] as const

export default function LandingScreen({
  onGetStarted,
}: {
  onGetStarted: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useGSAP(
    () => {
      const media = gsap.matchMedia()
      media.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          desktop: "(min-width: 921px)",
        },
        (context) => {
          const { reduceMotion, desktop } = context.conditions as {
            reduceMotion: boolean
            desktop: boolean
          }
          if (reduceMotion) return
          let cleanupMagnetic = () => {}

          const intro = gsap.timeline({ defaults: { ease: "power3.out" } })
          intro
            .from(".lp-header", { y: -18, autoAlpha: 0, duration: 0.55 })
            .from(
              ".lp-eyebrow--hero",
              { y: 16, autoAlpha: 0, duration: 0.45 },
              "-=.2",
            )
            .from(
              ".lp-title .lp-line > span",
              {
                yPercent: 110,
                autoAlpha: 0,
                duration: 0.72,
                stagger: 0.1,
                ease: "power4.out",
              },
              "-=.2",
            )
            .from(
              ".lp-subtitle",
              { y: 18, autoAlpha: 0, duration: 0.55 },
              "-=.34",
            )
            .from(
              ".lp-hero-actions",
              { y: 16, autoAlpha: 0, duration: 0.5 },
              "-=.28",
            )
            .from(
              ".lp-hero-proof div",
              { y: 12, autoAlpha: 0, duration: 0.4, stagger: 0.07 },
              "-=.25",
            )
            .from(
              ".lp-match-card",
              { y: 34, rotateY: -5, autoAlpha: 0, duration: 0.85 },
              "-=.6",
            )
            .from(
              ".lp-clear-chip",
              { x: -18, y: 14, autoAlpha: 0, duration: 0.45 },
              "-=.35",
            )
            .from(
              ".lp-progress-fill",
              { scaleX: 0, transformOrigin: "left center", duration: 0.65 },
              "-=.25",
            )

          gsap
            .timeline({
              delay: 0.25,
              repeat: -1,
              yoyo: true,
              defaults: { ease: "sine.inOut" },
            })
            .to(".lp-match-card", { y: -8, duration: 1.9 })
            .to(".lp-match-card", { y: 0, duration: 1.9 })
          gsap
            .timeline({
              delay: 0.42,
              repeat: -1,
              yoyo: true,
              defaults: { ease: "sine.inOut" },
            })
            .to(".lp-clear-chip", { y: -6, duration: 1.45 })
            .to(".lp-clear-chip", { y: 0, duration: 1.45 })

          gsap.to(".lp-orb--blue", {
            yPercent: 19,
            ease: "none",
            scrollTrigger: {
              trigger: ".lp-hero",
              start: "top top",
              end: "bottom top",
              scrub: 1,
            },
          })
          gsap.to(".lp-orb--amber", {
            yPercent: -13,
            ease: "none",
            scrollTrigger: {
              trigger: ".lp-hero",
              start: "top top",
              end: "bottom top",
              scrub: 1,
            },
          })

          gsap.to(".lp-hero-copy", {
            yPercent: -14,
            autoAlpha: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ".lp-hero",
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          })
          gsap.to(".lp-match-wrap", {
            yPercent: -8,
            scale: 0.94,
            autoAlpha: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ".lp-hero",
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          })
          gsap.to(".lp-scroll-cue", {
            autoAlpha: 0,
            ease: "none",
            scrollTrigger: {
              trigger: ".lp-hero",
              start: "top top",
              end: "+=240",
              scrub: true,
            },
          })

          gsap.utils.toArray<HTMLElement>(".lp-reveal").forEach((section) => {
            const pieces = section.querySelectorAll<HTMLElement>(
              ".lp-section-heading, .lp-workflows, .lp-principles-list, .lp-cta-box",
            )
            const targets = pieces.length ? Array.from(pieces) : [section]
            gsap.set(targets, { autoAlpha: 0, y: 32 })
            gsap.to(targets, {
              y: 0,
              autoAlpha: 1,
              duration: 0.8,
              stagger: 0.1,
              ease: "power3.out",
              scrollTrigger: { trigger: section, start: "top 84%", once: true },
            })
          })

          const primaryCta = rootRef.current?.querySelector<HTMLButtonElement>(
            ".lp-hero .lp-primary--blue",
          )
          if (primaryCta && desktop) {
            const xTo = gsap.quickTo(primaryCta, "x", {
              duration: 0.42,
              ease: "power3.out",
            })
            const yTo = gsap.quickTo(primaryCta, "y", {
              duration: 0.42,
              ease: "power3.out",
            })
            const reset = () => {
              xTo(0)
              yTo(0)
            }
            const move = (event: PointerEvent) => {
              const bounds = primaryCta.getBoundingClientRect()
              xTo((event.clientX - (bounds.left + bounds.width / 2)) * 0.08)
              yTo((event.clientY - (bounds.top + bounds.height / 2)) * 0.08)
            }
            primaryCta.addEventListener("pointermove", move)
            primaryCta.addEventListener("pointerleave", reset)
            cleanupMagnetic = () => {
              primaryCta.removeEventListener("pointermove", move)
              primaryCta.removeEventListener("pointerleave", reset)
            }
          }

          if (!desktop) return cleanupMagnetic

          const panels = gsap.utils.toArray<HTMLElement>(".lp-story-panel")
          const steps = gsap.utils.toArray<HTMLElement>(".lp-story-step")
          gsap.set(panels, { autoAlpha: 0, y: 34, scale: 0.96 })
          gsap.set(steps, {
            color: "#7b8598",
            backgroundColor: "transparent",
            borderColor: "transparent",
          })

          const story = gsap.timeline({
            scrollTrigger: {
              trigger: ".lp-story",
              start: "top top",
              end: "+=1500",
              pin: true,
              scrub: 1,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            },
          })

          panels.forEach((panel, index) => {
            const step = steps[index]
            if (!step) return
            story
              .to(
                panel,
                {
                  autoAlpha: 1,
                  y: 0,
                  scale: 1,
                  duration: index === 0 ? 1.05 : 0.85,
                  ease: "power2.out",
                },
                index === 0 ? 0 : ">-.15",
              )
              .to(
                step,
                {
                  color: "#f4f6fb",
                  backgroundColor: "rgba(255,255,255,.045)",
                  borderColor: "rgba(79,124,255,.32)",
                  duration: 0.28,
                },
                "<",
              )

            if (index < panels.length - 1) {
              story
                .to(panel, {
                  autoAlpha: 0,
                  y: -28,
                  scale: 1.03,
                  duration: 0.72,
                  ease: "power1.in",
                })
                .to(
                  step,
                  {
                    color: "#7b8598",
                    backgroundColor: "transparent",
                    borderColor: "transparent",
                    duration: 0.24,
                  },
                  "<",
                )
            }
          })
          return cleanupMagnetic
        },
      )
      return () => media.revert()
    },
    { scope: rootRef },
  )

  useEffect(() => {
    const hero = rootRef.current?.querySelector<HTMLElement>(".lp-hero")
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-72px 0px 0px" },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const target = rootRef.current?.querySelector<HTMLElement>(`#${id}`)
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={rootRef} className="fitcv-landing">
      <style>{landingCss}</style>
      <header className={`lp-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="lp-shell lp-header-in">
          <button
            className="lp-brand"
            onClick={() => scrollTo("top")}
            aria-label="FitCV home"
          >
            <span className="lp-brand-mark">
              <BrandMark size={30} />
            </span>
            FitCV
          </button>
          <nav className="lp-nav" aria-label="Landing navigation">
            <button onClick={() => scrollTo("workflows")}>Approach</button>
            <button onClick={() => scrollTo("story")}>The workflow</button>
            <button onClick={() => scrollTo("principles")}>
              Why it holds up
            </button>
            <button onClick={() => scrollTo("start")}>For teams</button>
          </nav>
          <div className="lp-header-actions">
            <button className="lp-text-button" onClick={onGetStarted}>
              Sign in
            </button>
            <button className="lp-primary" onClick={onGetStarted}>
              Enter FitCV
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero" aria-labelledby="landing-title">
          <div className="lp-orb lp-orb--blue" aria-hidden="true" />
          <div className="lp-orb lp-orb--amber" aria-hidden="true" />
          <div className="lp-orb lp-orb--small" aria-hidden="true" />
          <div className="lp-grain" aria-hidden="true" />
          <ParticleField />
          <div className="lp-shell lp-hero-grid">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow lp-eyebrow--hero">
                EVIDENCE-FIRST CAREER INTELLIGENCE
              </span>
              <h1 id="landing-title" className="lp-title">
                <span className="lp-line">
                  <span>Every match, made</span>
                </span>
                <span className="lp-line">
                  <span>
                    <em>legible.</em>
                  </span>
                </span>
              </h1>
              <p className="lp-subtitle">
                FitCV reads a CV and a role side by side, then shows the
                evidence behind the fit. The score is where the conversation
                starts, not where it ends.
              </p>
              <div className="lp-hero-actions">
                <button
                  className="lp-primary lp-primary--blue"
                  onClick={onGetStarted}
                >
                  Enter FitCV <ArrowRight size={16} weight="bold" />
                </button>
                <button
                  className="lp-secondary"
                  onClick={() => scrollTo("story")}
                >
                  See how it reads <ArrowUpRight size={15} weight="bold" />
                </button>
              </div>
              <div className="lp-hero-proof">
                <div>
                  <strong>Two portals</strong>
                  <span>For applicants and hiring teams</span>
                </div>
                <div>
                  <strong>PDF &middot; DOCX</strong>
                  <span>Parsed with sections intact</span>
                </div>
                <div>
                  <strong>Evidence-linked</strong>
                  <span>Every score shows its source</span>
                </div>
              </div>
            </div>

            <div className="lp-match-wrap">
              <article
                className="lp-match-card"
                aria-label="Example match evidence review"
              >
                <div className="lp-match-top">
                  <div className="lp-match-brand">
                    <span className="lp-match-icon">
                      <BrandMark size={20} />
                    </span>
                    <span>
                      <strong>Match evidence</strong>
                      <small>Frontend Developer Intern</small>
                    </span>
                  </div>
                  <b className="lp-ready">Evidence ready</b>
                </div>
                <div className="lp-match-body">
                  <div className="lp-match-pane">
                    <div className="lp-candidate-row">
                      <div className="lp-candidate">
                        <span className="lp-avatar">
                          <User size={17} weight="bold" />
                        </span>
                        <span>
                          <strong>Candidate review</strong>
                          <small>Software Engineering</small>
                        </span>
                      </div>
                      <ArrowUpRight className="lp-open-icon" size={15} />
                    </div>
                    <div className="lp-meter-block">
                      <div className="lp-row">
                        <label>Role alignment</label>
                        <span>82%</span>
                      </div>
                      <div className="lp-progress">
                        <i className="lp-progress-fill" />
                      </div>
                    </div>
                    <div className="lp-chips">
                      <span>React</span>
                      <span>TypeScript</span>
                      <span>SQL</span>
                      <span>Git</span>
                      <span>+3 matched</span>
                    </div>
                    <div className="lp-review-note">
                      <b>Worth reviewing:</b> add deployment evidence for this
                      role.
                    </div>
                  </div>
                  <div className="lp-match-pane lp-evidence-pane">
                    <div className="lp-evidence-head">
                      <span>
                        <strong>Role alignment</strong>
                        <small>
                          Evidence grouped by what matters to the role
                        </small>
                      </span>
                      <b className="lp-score">
                        82<small>/100</small>
                      </b>
                    </div>
                    <div className="lp-evidence-list">
                      <div className="lp-evidence-line">
                        <span>Skills</span>
                        <b>
                          <i className="lp-state-dot" />
                          Strong
                        </b>
                      </div>
                      <div className="lp-evidence-line">
                        <span>Experience</span>
                        <b>
                          <i className="lp-state-dot lp-state-dot--amber" />
                          Partial
                        </b>
                      </div>
                      <div className="lp-evidence-line">
                        <span>Education</span>
                        <b>
                          <i className="lp-state-dot lp-state-dot--green" />
                          Relevant
                        </b>
                      </div>
                    </div>
                    <div className="lp-source">
                      <CheckCircle size={12} weight="fill" />
                      Source-grounded review
                    </div>
                  </div>
                </div>
              </article>
              <div className="lp-clear-chip">
                <strong>Clear next action</strong>
                <span>Add one project outcome</span>
              </div>
            </div>
          </div>
          <div className="lp-scroll-cue" aria-hidden="true">
            <span>SCROLL</span>
            <i className="lp-scroll-line" />
          </div>
        </section>

        <section className="lp-rail" aria-label="FitCV principles">
          <div className="lp-marquee">
            <div className="lp-marquee-track">
              <div className="lp-marquee-set">
                {trustItems.map((item) => (
                  <span className="lp-rail-item" key={`a-${item}`}>
                    {item}
                  </span>
                ))}
              </div>
              <div className="lp-marquee-set" aria-hidden="true">
                {trustItems.map((item) => (
                  <span className="lp-rail-item" key={`b-${item}`}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="workflows"
          className="lp-section lp-reveal"
          aria-labelledby="workflows-title"
        >
          <div className="lp-shell">
            <div className="lp-section-heading">
              <span className="lp-eyebrow">ONE ENGINE, TWO VANTAGE POINTS</span>
              <h2 id="workflows-title" className="lp-section-title">
                Make the next move easier to <em>explain.</em>
              </h2>
              <p className="lp-section-copy">
                The same source-grounded engine gives job seekers a clear next
                step and gives hiring teams a defensible read on every
                candidate.
              </p>
            </div>
            <div className="lp-workflows">
              <Workflow
                icon={<User size={21} weight="bold" />}
                label="FOR JOB SEEKERS"
                title="Know what to strengthen before you apply."
                copy="See how your CV maps to a real role, with the evidence and the gaps in plain sight."
                steps={seekerSteps}
              />
              <Workflow
                accent="amber"
                icon={<Briefcase size={21} weight="bold" />}
                label="FOR HIRING TEAMS"
                title="Review candidates with context, not clutter."
                copy="Bring external CVs or applications already in FitCV and keep every screening call anchored to evidence."
                steps={hiringSteps}
              />
            </div>
          </div>
        </section>

        <section id="story" className="lp-story" aria-labelledby="story-title">
          <div className="lp-shell lp-story-grid">
            <div className="lp-story-copy">
              <span className="lp-eyebrow">SEE THE SIGNAL</span>
              <h2 id="story-title">
                From a raw CV to a decision you can <em>defend.</em>
              </h2>
              <p>
                Scroll through the same review journey your users move through.
                Every step keeps the source next to the decision.
              </p>
              <div className="lp-story-steps">
                <span className="lp-story-step is-active">
                  <b>01</b>
                  <span>Bring in a CV and a real role</span>
                </span>
                <span className="lp-story-step">
                  <b>02</b>
                  <span>See the evidence behind the match</span>
                </span>
                <span className="lp-story-step">
                  <b>03</b>
                  <span>Choose the next action with context</span>
                </span>
              </div>
            </div>
            <div className="lp-story-stage" aria-label="FitCV review journey">
              <div className="lp-story-panels">
                <article className="lp-story-panel">
                  <div className="lp-story-panel-top">
                    <span className="lp-story-panel-title">
                      <FileText size={17} weight="bold" />
                      CV and role ready
                    </span>
                    <span className="lp-story-status">Parsed</span>
                  </div>
                  <div className="lp-story-panel-body">
                    <div className="lp-story-pane">
                      <h3>Frontend Developer Intern</h3>
                      <p>
                        React, TypeScript, SQL, and deployment signals are
                        visible in the brief.
                      </p>
                      <div className="lp-story-meter">
                        <i />
                      </div>
                      <div className="lp-story-checks">
                        <span className="lp-story-check">
                          <span>CV text extracted</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Ready
                          </b>
                        </span>
                        <span className="lp-story-check">
                          <span>Role requirements mapped</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Ready
                          </b>
                        </span>
                      </div>
                      <div className="lp-story-detected">
                        <span className="lp-story-micro">
                          Detected sections
                        </span>
                        <div className="lp-chips lp-story-chips">
                          <span>Summary</span>
                          <span>Skills</span>
                          <span>Experience</span>
                          <span>Education</span>
                          <span>Projects</span>
                        </div>
                      </div>
                    </div>
                    <div className="lp-story-pane lp-story-pane--dark">
                      <h3>Source context</h3>
                      <p>
                        Every review keeps source material close to the
                        decision.
                      </p>
                      <div className="lp-story-evidence">
                        <div>
                          <span>Skills</span>
                          <b>12 found</b>
                        </div>
                        <div>
                          <span>Experience</span>
                          <b>4 signals</b>
                        </div>
                        <div>
                          <span>Education</span>
                          <b>Relevant</b>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
                <article className="lp-story-panel">
                  <div className="lp-story-panel-top">
                    <span className="lp-story-panel-title">
                      <Sparkle size={17} weight="fill" />
                      Match evidence
                    </span>
                    <span className="lp-story-status">Reviewable</span>
                  </div>
                  <div className="lp-story-panel-body">
                    <div className="lp-story-pane lp-story-pane--dark">
                      <h3>Role alignment</h3>
                      <div className="lp-story-score">
                        82<small>/100</small>
                      </div>
                      <div className="lp-evidence-strength">
                        <span className="lp-story-micro">
                          Evidence strength
                        </span>
                        <div className="lp-strength-row">
                          <span>Technical skills</span>
                          <span className="lp-strength-bar">
                            <i
                              style={{ "--strength": "88%" } as CSSProperties}
                            />
                          </span>
                          <b className="lp-strength-value">88</b>
                        </div>
                        <div className="lp-strength-row lp-strength-row--amber">
                          <span>Experience</span>
                          <span className="lp-strength-bar">
                            <i
                              style={{ "--strength": "74%" } as CSSProperties}
                            />
                          </span>
                          <b className="lp-strength-value">74</b>
                        </div>
                        <div className="lp-strength-row">
                          <span>Education</span>
                          <span className="lp-strength-bar">
                            <i
                              style={{ "--strength": "80%" } as CSSProperties}
                            />
                          </span>
                          <b className="lp-strength-value">80</b>
                        </div>
                      </div>
                      <p>
                        A strong match with one gap worth closing before you
                        apply.
                      </p>
                    </div>
                    <div className="lp-story-pane">
                      <h3>Why this score</h3>
                      <div className="lp-story-checks">
                        <span className="lp-story-check">
                          <span>Technical skills</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Strong
                          </b>
                        </span>
                        <span className="lp-story-check">
                          <span>Experience</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Partial
                          </b>
                        </span>
                        <span className="lp-story-check">
                          <span>Education</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Relevant
                          </b>
                        </span>
                      </div>
                      <div className="lp-story-message">
                        Worth reviewing: add one deployment outcome from a real
                        project.
                      </div>
                    </div>
                  </div>
                </article>
                <article className="lp-story-panel lp-story-panel--amber">
                  <div className="lp-story-panel-top">
                    <span className="lp-story-panel-title">
                      <ShieldCheck size={17} weight="bold" />
                      Human review
                    </span>
                    <span className="lp-story-status">In control</span>
                  </div>
                  <div className="lp-story-panel-body">
                    <div className="lp-story-pane">
                      <h3>Next action</h3>
                      <div className="lp-story-checks">
                        <span className="lp-story-check">
                          <span>Save improvement suggestion</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Ready
                          </b>
                        </span>
                        <span className="lp-story-check">
                          <span>Open application tracker</span>
                          <b>
                            <CheckCircle size={13} weight="fill" />
                            Ready
                          </b>
                        </span>
                        <span className="lp-story-check">
                          <span>Compare against another role</span>
                          <b className="lp-story-check--optional">Optional</b>
                        </span>
                      </div>
                    </div>
                    <div className="lp-story-pane lp-story-pane--dark">
                      <h3>Review trail</h3>
                      <p>
                        FitCV supports judgment. It never auto-accepts or
                        rejects a person.
                      </p>
                      <div className="lp-review-trail">
                        <span className="lp-review-trail-item">CV parsed</span>
                        <span className="lp-review-trail-item">
                          Evidence grouped
                        </span>
                        <span className="lp-review-trail-item lp-review-trail-item--pending">
                          Awaiting your decision
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section
          id="principles"
          className="lp-principles-section lp-reveal"
          aria-labelledby="principles-title"
        >
          <div className="lp-shell lp-principles-grid">
            <div className="lp-section-heading">
              <span className="lp-eyebrow">WHY IT HOLDS UP</span>
              <h2 id="principles-title" className="lp-section-title">
                AI is more useful when you can <em>check it.</em>
              </h2>
              <p className="lp-section-copy">
                FitCV is built to make the review more rigorous, not to replace
                the reviewer.
              </p>
            </div>
            <div className="lp-principles-list">
              <article className="lp-principle">
                <span className="lp-principle-icon">
                  <MagnifyingGlass size={20} weight="bold" />
                </span>
                <b className="lp-principle-index">01</b>
                <h3>Evidence, not guesses</h3>
                <p>
                  Skills, education, and experience appear with the source text
                  that supports them.
                </p>
              </article>
              <article className="lp-principle">
                <span className="lp-principle-icon">
                  <ChartBar size={20} weight="bold" />
                </span>
                <b className="lp-principle-index">02</b>
                <h3>One shared language</h3>
                <p>
                  Seekers and hiring teams read the same match logic, framed for
                  their own workflow.
                </p>
              </article>
              <article className="lp-principle">
                <span className="lp-principle-icon">
                  <ShieldCheck size={20} weight="bold" />
                </span>
                <b className="lp-principle-index">03</b>
                <h3>A decision aid, never a verdict</h3>
                <p>
                  FitCV surfaces information for review. It never auto-accepts
                  or rejects a person.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          id="start"
          className="lp-cta lp-reveal"
          aria-labelledby="cta-title"
        >
          <div className="lp-shell">
            <div className="lp-cta-box">
              <div className="lp-cta-copy">
                <span className="lp-eyebrow">START WHERE YOU ARE</span>
                <h2 id="cta-title">
                  A sharper review starts with the actual <em>CV.</em>
                </h2>
                <p>
                  Upload a document, bring a role, and get a structured view of
                  what is already there and what deserves attention next.
                </p>
                <button className="lp-primary" onClick={onGetStarted}>
                  Enter FitCV <ArrowRight size={16} weight="bold" />
                </button>
                <p className="lp-cta-note">PDF and DOCX accepted.</p>
              </div>
              <div className="lp-cta-art" aria-hidden="true">
                <i className="lp-cta-orb" />
                <i className="lp-cta-orb lp-cta-orb--amber" />
                <div className="lp-ready-card">
                  <Sparkle size={19} weight="fill" />
                  <h3>Ready to review</h3>
                  <p>
                    Bring a CV and a role. FitCV organizes the evidence for
                    review.
                  </p>
                  <span>
                    <CheckCircle size={14} weight="fill" />
                    Ready when you are
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-shell lp-footer-in">
          <div className="lp-footer-main">
            <span className="lp-footer-brand">
              <i>
                <BrandMark size={23} />
              </i>
              FitCV
            </span>
            <span>Career decisions, made reviewable.</span>
          </div>
          <button className="lp-link-button" onClick={onGetStarted}>
            Enter FitCV
          </button>
          <small>Evidence-first career intelligence.</small>
        </div>
      </footer>
    </div>
  )
}
