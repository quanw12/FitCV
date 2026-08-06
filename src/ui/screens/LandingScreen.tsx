import { useEffect, useRef, useState, type ReactNode } from "react"
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

interface LandingScreenProps {
  onGetStarted: () => void
}

const landingCss = `
  .fitcv-landing {
    --lp-ink: #101828;
    --lp-slate: #475467;
    --lp-muted: #667085;
    --lp-line: #e4e7ec;
    --lp-paper: #fcfcfb;
    --lp-blue: #2563eb;
    --lp-orange: #d97706;
    min-height: 100dvh;
    overflow-x: hidden;
    background: var(--lp-paper);
    color: var(--lp-ink);
    font-family: var(--font-body, Geist, system-ui, sans-serif);
  }
  .fitcv-landing *, .fitcv-landing *::before, .fitcv-landing *::after { box-sizing: border-box; }
  .fitcv-landing button { font: inherit; }
  .lp-shell { width: min(1280px, calc(100% - 48px)); margin: 0 auto; }
  .lp-header { position: sticky; top: 0; z-index: 20; height: 70px; border-bottom: 1px solid transparent; background: rgba(252,252,251,.92); transition: border-color .2s ease, box-shadow .2s ease; backdrop-filter: blur(12px); }
  .lp-header.is-scrolled { border-color: var(--lp-line); box-shadow: 0 4px 18px rgba(16,24,40,.04); }
  .lp-header-in { height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .lp-brand, .lp-text-button, .lp-nav button, .lp-link-button { border: 0; background: transparent; cursor: pointer; }
  .lp-brand { display: inline-flex; align-items: center; gap: 6px; padding: 0; color: var(--lp-ink); font-size: 18px; font-weight: 750; letter-spacing: -.055em; }
  .lp-brand-mark { width: 32px; height: 32px; display: grid; place-items: center; }
  .lp-nav { display: flex; align-items: center; gap: 30px; }
  .lp-nav button, .lp-text-button { padding: 6px 0; color: var(--lp-slate); font-size: 13px; font-weight: 560; transition: color .15s ease; }
  .lp-nav button:hover, .lp-text-button:hover { color: var(--lp-ink); }
  .lp-header-actions { display: flex; align-items: center; gap: 18px; }
  .lp-primary, .lp-secondary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 9px; padding: 0 17px; cursor: pointer; font-size: 13px; font-weight: 700; transition: transform .18s ease, background .18s ease, border-color .18s ease; }
  .lp-primary { border: 1px solid var(--lp-ink); background: var(--lp-ink); color: #fff; box-shadow: 0 1px 2px rgba(16,24,40,.12); }
  .lp-primary:hover { transform: translateY(-2px); background: #1d2939; }
  .lp-primary.blue { border-color: var(--lp-blue); background: var(--lp-blue); }
  .lp-primary.blue:hover { background: #1d4ed8; }
  .lp-secondary { border: 1px solid #d0d5dd; background: #fff; color: #344054; }
  .lp-secondary:hover { transform: translateY(-2px); border-color: #98a2b3; }
  .lp-hero { position: relative; overflow: hidden; border-bottom: 1px solid #dbe7f5; padding: 104px 0 96px; background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%); color: var(--lp-ink); }.lp-hero::before { position: absolute; inset: 0; pointer-events: none; content: ''; background: radial-gradient(circle at 84% 32%, rgba(37,99,235,.14), transparent 26%), radial-gradient(circle at 8% 92%, rgba(14,165,233,.1), transparent 24%); }.lp-hero::after { position: absolute; right: -16vw; bottom: -32vw; width: 58vw; height: 58vw; border: 1px solid rgba(37,99,235,.14); border-radius: 50%; content: ''; box-shadow: 0 0 0 70px rgba(37,99,235,.025), 0 0 0 140px rgba(37,99,235,.018); }
  .lp-hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0,.76fr) minmax(540px,1.24fr); align-items: center; gap: 76px; }
  .lp-kicker { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #cfe0ff; border-radius: 999px; background: rgba(255,255,255,.72); padding: 7px 11px; color: #1d4ed8; font-size: 11px; font-weight: 700; }
  .lp-title { max-width: 650px; margin: 22px 0 0; font-size: clamp(52px, 5.65vw, 82px); font-weight: 700; line-height: .95; letter-spacing: -.072em; }.lp-title-line { display: block; overflow: hidden; }.lp-title-line > span { display: block; }
  .lp-subtitle { max-width: 520px; margin: 26px 0 0; color: #475467; font-size: 17px; line-height: 1.62; }
  .lp-hero-actions { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 31px; }
  .lp-hero .lp-secondary { border-color: #c7d7ee; background: rgba(255,255,255,.72); color: #344054; }.lp-hero .lp-secondary:hover { border-color: #98a2b3; background: #fff; }
  .lp-note { margin: 15px 0 0; color: #667085; font-size: 12px; }
  .lp-preview-wrap { position: relative; max-width: 735px; margin-left: auto; }
  .lp-preview { position: relative; z-index: 1; overflow: hidden; border: 1px solid #dfe3eb; border-radius: 22px; background: #fff; box-shadow: 0 30px 80px -36px rgba(16,24,40,.38); }
  .lp-preview-top { display: flex; align-items: center; justify-content: space-between; padding: 13px 17px; border-bottom: 1px solid #e9ecf2; }
  .lp-mini-brand, .lp-mini-profile { display: flex; align-items: center; gap: 9px; }
  .lp-mini-icon { display: grid; width: 26px; height: 26px; place-items: center; }
  .lp-mini-brand strong, .lp-mini-profile strong { display: block; font-size: 11px; line-height: 1.2; }
  .lp-mini-brand small, .lp-mini-profile small { display: block; margin-top: 2px; color: #98a2b3; font-size: 9px; }
  .lp-ready { border-radius: 999px; background: #ecfdf3; padding: 5px 8px; color: #067647; font-size: 9px; font-weight: 700; }
  .lp-preview-content { display: grid; grid-template-columns: 1.08fr .92fr; gap: 12px; padding: 13px; background: #f8fafc; }
  .lp-profile-card { border: 1px solid #e5eaf1; border-radius: 13px; background: #fff; padding: 15px; }
  .lp-avatar { display: grid; width: 36px; height: 36px; place-items: center; border-radius: 50%; background: #eaf2ff; color: var(--lp-blue); }
  .lp-profile-head { display: flex; align-items: flex-start; justify-content: space-between; }
  .lp-open-icon { color: #98a2b3; }
  .lp-progress-block { margin-top: 17px; }
  .lp-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .lp-row label, .lp-row span { color: #667085; font-size: 9px; font-weight: 600; }
  .lp-row span { color: var(--lp-ink); }
  .lp-progress { height: 6px; margin-top: 7px; overflow: hidden; border-radius: 99px; background: #edf1f7; }
  .lp-progress > i { display: block; width: 82%; height: 100%; border-radius: inherit; background: var(--lp-blue); transform-origin: left; }
  .lp-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 15px; }
  .lp-chips span { border-radius: 5px; background: #f1f5f9; padding: 5px 7px; color: #475467; font-size: 9px; font-weight: 650; }
  .lp-chips span:last-child { color: #1d4ed8; background: #eff6ff; }
  .lp-tip { margin-top: 14px; border: 1px solid #fedf89; border-radius: 8px; background: #fffaeb; padding: 8px 9px; color: #7a2e0e; font-size: 9px; line-height: 1.45; }
  .lp-evidence { border-radius: 13px; background: var(--lp-ink); padding: 15px; color: #fff; }
  .lp-evidence-head { display: flex; align-items: flex-start; justify-content: space-between; }
  .lp-evidence-head strong { display: block; font-size: 11px; }
  .lp-evidence-head small { display: block; margin-top: 3px; color: #98a2b3; font-size: 9px; }
  .lp-score { font-size: 20px; font-weight: 750; letter-spacing: -.07em; }
  .lp-score small { display: inline; margin: 0; color: #98a2b3; font-size: 9px; letter-spacing: 0; }
  .lp-evidence-list { margin-top: 18px; }
  .lp-evidence-line { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.1); padding: 9px 0; color: #cbd5e1; font-size: 9px; }
  .lp-evidence-line:last-child { border: 0; }
  .lp-evidence-line b { display: flex; align-items: center; gap: 5px; color: #fff; font-size: 9px; }
  .lp-state-dot { width: 6px; height: 6px; border-radius: 50%; background: #60a5fa; }
  .lp-state-dot.orange { background: #fbbf24; }.lp-state-dot.green { background: #34d399; }
  .lp-source { display: flex; align-items: center; gap: 5px; margin-top: 14px; color: #a7f3d0; font-size: 9px; }
  .lp-float-note { position: absolute; z-index: 2; left: -21px; bottom: -16px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; padding: 9px 12px; box-shadow: 0 10px 25px rgba(16,24,40,.12); }
  .lp-float-note b, .lp-float-note span { display: block; font-size: 9px; }.lp-float-note b { color: var(--lp-ink); }.lp-float-note span { margin-top: 3px; color: #667085; }
  .lp-rail { border-bottom: 1px solid var(--lp-line); background: #fff; }
  .lp-rail-in { display: flex; flex-wrap: wrap; align-items: center; gap: 28px; min-height: 58px; color: #667085; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .lp-rail-in > b { color: #344054; }.lp-rail-item { display: inline-flex; align-items: center; gap: 7px; }.lp-rail-item.blue { color: var(--lp-blue); }.lp-rail-item.orange { color: var(--lp-orange); }.lp-rail-item.green { color: #079455; }
  .lp-section { padding: 108px 0; }.lp-section-head { display: grid; grid-template-columns: .84fr 1.16fr; gap: 60px; align-items: end; border-bottom: 1px solid var(--lp-line); padding-bottom: 47px; }.lp-section-flow { min-height: 218px; }.lp-flow-visual { position: relative; display: flex; align-items: center; gap: 8px; width: 290px; margin-top: 22px; }.lp-flow-rail { position: absolute; top: 21px; right: 19px; left: 19px; height: 1px; overflow: hidden; background: #dbe4f0; }.lp-flow-rail::after { position: absolute; top: 0; left: -35%; width: 35%; height: 100%; content: ''; background: var(--lp-blue); animation: lp-flow-signal 3.6s ease-in-out 1 both; }.lp-flow-visual.hr { margin-top: 25px; }.lp-flow-visual.hr .lp-flow-rail::after { background: var(--lp-orange); animation-delay: 1.1s; }.lp-flow-node { position: relative; z-index: 1; display: grid; width: 44px; height: 44px; place-items: center; border: 1px solid #d7e0ec; border-radius: 13px; background: #fff; color: #667085; box-shadow: 0 7px 15px -13px rgba(16,24,40,.45); animation: lp-flow-node .6s both; }.lp-flow-node:nth-of-type(3) { animation-delay: .16s; }.lp-flow-node:nth-of-type(4) { animation-delay: .32s; }.lp-flow-node.engine { border-color: #cfe0ff; color: var(--lp-blue); background: #eff6ff; }.lp-flow-node.review { border-color: #d1fadf; color: #079455; background: #ecfdf3; }.lp-flow-visual.hr .lp-flow-node.engine { border-color: #fed7aa; color: #d97706; background: #fff7ed; }.lp-flow-visual.hr .lp-flow-node.review { border-color: #fed7aa; color: #b45309; background: #fffaf5; }.lp-flow-caption { position: absolute; top: 53px; width: 60px; color: #98a2b3; font-size: 8px; font-weight: 750; letter-spacing: .08em; line-height: 1.3; text-align: center; text-transform: uppercase; }.lp-flow-caption.one { left: -8px; }.lp-flow-caption.two { left: 107px; }.lp-flow-caption.three { left: 221px; }.lp-flow-visual.hr .lp-flow-caption { color: #b08968; }.lp-reveal { opacity: 1; transform: none; }.lp-reveal.is-visible { opacity: 1; transform: none; }.lp-reveal .lp-workflow, .lp-reveal .lp-principle { opacity: 1; transform: none; }.lp-reveal.is-visible .lp-workflow, .lp-reveal.is-visible .lp-principle { opacity: 1; transform: none; }
  .lp-eyebrow { display: flex; align-items: center; gap: 10px; color: #667085; font-size: 11px; font-weight: 750; letter-spacing: .15em; text-transform: uppercase; }.lp-eyebrow::before { width: 27px; height: 1px; content: ''; background: #cbd5e1; }
  .lp-section-title { max-width: 690px; margin: 0; font-size: clamp(34px,4vw,55px); font-weight: 700; line-height: 1.04; letter-spacing: -.055em; }.lp-section-copy { max-width: 600px; margin: 19px 0 0; color: var(--lp-slate); font-size: 15px; line-height: 1.72; }
  .lp-workflows { display: grid; grid-template-columns: minmax(0,.9fr) minmax(0,1.1fr); gap: 18px; margin-top: 31px; }
  .lp-workflow { min-height: 396px; border: 1px solid #dde3ec; border-radius: 20px; background: #fff; padding: 31px; transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }.lp-workflow:hover { transform: translateY(-5px); border-color: #c7d2fe; box-shadow: 0 24px 50px -36px rgba(37,99,235,.45); }.lp-workflow.orange:hover { border-color: #fed7aa; box-shadow: 0 24px 50px -36px rgba(217,119,6,.45); }
  .lp-workflow-top { display: flex; align-items: center; justify-content: space-between; }.lp-workflow-icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 12px; color: #fff; background: var(--lp-blue); }.lp-workflow.orange .lp-workflow-icon { background: var(--lp-orange); }.lp-workflow-label { color: var(--lp-blue); font-size: 10px; font-weight: 750; letter-spacing: .14em; text-transform: uppercase; }.lp-workflow.orange .lp-workflow-label { color: var(--lp-orange); }
  .lp-workflow h3 { max-width: 420px; margin: 34px 0 0; font-size: 28px; font-weight: 700; line-height: 1.1; letter-spacing: -.045em; }.lp-workflow p { max-width: 500px; margin: 13px 0 0; color: var(--lp-slate); font-size: 14px; line-height: 1.65; }.lp-workflow ol { display: grid; gap: 13px; margin: 27px 0 0; padding: 20px 0 0; border-top: 1px solid #eaf0f7; list-style: none; }.lp-workflow li { display: grid; grid-template-columns: 28px 1fr; gap: 8px; color: #475467; font-size: 13px; line-height: 1.4; }.lp-workflow li b { color: var(--lp-blue); font-size: 11px; }.lp-workflow.orange li b { color: var(--lp-orange); }
  .lp-story { position: relative; overflow: hidden; min-height: 100dvh; padding: 100px 0; scroll-margin-top: 70px; background: #f4f8ff; }.lp-story-grid { display: grid; min-height: calc(100dvh - 200px); grid-template-columns: minmax(0,.72fr) minmax(0,1.28fr); align-items: center; gap: 74px; }.lp-story-copy { position: relative; z-index: 1; }.lp-story-copy h2 { max-width: 520px; margin: 18px 0 0; font-size: clamp(40px,4.5vw,64px); line-height: .99; letter-spacing: -.065em; }.lp-story-copy p { max-width: 430px; margin: 20px 0 0; color: var(--lp-slate); font-size: 15px; line-height: 1.7; }.lp-story-steps { display: grid; gap: 8px; margin-top: 34px; }.lp-story-step { display: grid; grid-template-columns: 30px 1fr; gap: 11px; align-items: center; border: 1px solid transparent; border-radius: 12px; padding: 10px 12px; color: #667085; font-size: 13px; transition: color .25s ease, background .25s ease, border-color .25s ease; }.lp-story-step b { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 50%; background: #e4edff; color: var(--lp-blue); font-size: 11px; }.lp-story-step.is-active { border-color: #cfe0ff; background: rgba(255,255,255,.82); color: var(--lp-ink); box-shadow: 0 12px 28px -24px rgba(37,99,235,.55); }.lp-story-stage { position: relative; min-height: 470px; perspective: 1200px; }.lp-story-stage::before { position: absolute; inset: 12% 4% 8%; border: 1px solid #dbe7f5; border-radius: 32px; background: radial-gradient(circle at 78% 20%, rgba(37,99,235,.12), transparent 30%), #eaf2ff; content: ''; }.lp-story-panel { position: absolute; inset: 8% 5% 4%; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dbe3ef; border-radius: 22px; background: #fff; box-shadow: 0 35px 75px -44px rgba(16,24,40,.42); opacity: 0; visibility: hidden; }.lp-story-panel-top { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #edf1f7; padding: 17px 20px; }.lp-story-panel-title { display: flex; align-items: center; gap: 9px; font-size: 12px; font-weight: 750; }.lp-story-panel-title svg { color: var(--lp-blue); }.lp-story-panel--orange .lp-story-panel-title svg { color: var(--lp-orange); }.lp-story-status { border-radius: 999px; background: #ecfdf3; padding: 5px 9px; color: #067647; font-size: 10px; font-weight: 750; }.lp-story-panel-body { display: grid; flex: 1; grid-template-columns: 1.08fr .92fr; gap: 15px; padding: 18px; background: #f8fafc; }.lp-story-pane { border: 1px solid #e5eaf1; border-radius: 15px; background: #fff; padding: 18px; }.lp-story-pane--dark { border-color: #1f2937; background: #111827; color: #fff; }.lp-story-pane h3 { margin: 0; font-size: 16px; letter-spacing: -.035em; }.lp-story-pane p { margin: 10px 0 0; color: #667085; font-size: 12px; line-height: 1.55; }.lp-story-pane--dark p { color: #9ca3af; }.lp-story-meter { height: 9px; margin-top: 25px; overflow: hidden; border-radius: 99px; background: #e5eaf1; }.lp-story-meter i { display: block; width: 82%; height: 100%; border-radius: inherit; background: var(--lp-blue); }.lp-story-checks { display: grid; gap: 11px; margin-top: 22px; }.lp-story-check { display: flex; align-items: center; justify-content: space-between; color: #475467; font-size: 11px; }.lp-story-check b { display: inline-flex; align-items: center; gap: 5px; color: #079455; }.lp-story-check b svg { color: #16a34a; }.lp-story-score { margin-top: 22px; font-size: 50px; font-weight: 750; letter-spacing: -.08em; }.lp-story-score small { margin-left: 4px; color: #9ca3af; font-size: 13px; letter-spacing: 0; }.lp-story-evidence { display: grid; gap: 0; margin-top: 20px; }.lp-story-evidence div { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,.1); padding: 12px 0; color: #cbd5e1; font-size: 11px; }.lp-story-evidence b { color: #fff; }.lp-story-message { margin-top: auto; border: 1px solid #fedf89; border-radius: 10px; background: #fffaeb; padding: 11px; color: #7a2e0e; font-size: 11px; line-height: 1.45; }.lp-story-panel--orange .lp-story-message { border-color: #fed7aa; background: #fff7ed; color: #9a3412; }
  .lp-dark { background: var(--lp-ink); color: #fff; }.lp-dark .lp-section { display: grid; grid-template-columns: .8fr 1.2fr; gap: 65px; }.lp-dark .lp-eyebrow { color: #98a2b3; }.lp-dark .lp-eyebrow::before { background: #475467; }.lp-dark .lp-section-copy { color: #98a2b3; }.lp-principles { display: grid; grid-template-columns: minmax(0,1.08fr) minmax(0,.92fr); grid-template-rows: repeat(2,minmax(0,1fr)); gap: 14px; align-self: end; }.lp-principle { min-height: 0; border: 1px solid rgba(255,255,255,.12); padding: 24px; background: rgba(255,255,255,.035); transition: background .2s ease, transform .2s ease; }.lp-principle:first-child { grid-row: span 2; }.lp-principle:hover { background: rgba(255,255,255,.08); transform: translateY(-3px); }.lp-principle-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 10px; background: rgba(255,255,255,.1); }.lp-principle-index { display: block; margin: 54px 0 12px; color: #667085; font-size: 10px; font-weight: 700; letter-spacing: .12em; }.lp-principle h3 { margin: 0; font-size: 18px; letter-spacing: -.03em; }.lp-principle p { margin: 11px 0 0; color: #98a2b3; font-size: 13px; line-height: 1.55; }
  .lp-cta { padding: 104px 0; }.lp-cta-box { display: grid; grid-template-columns: 1.05fr .95fr; overflow: hidden; border: 1px solid #dfe3eb; border-radius: 24px; background: #fff; }.lp-cta-copy { padding: 53px; }.lp-cta-copy h2 { max-width: 620px; margin: 18px 0 0; font-size: clamp(34px,4vw,55px); font-weight: 700; line-height: 1.05; letter-spacing: -.055em; }.lp-cta-copy p { max-width: 580px; margin: 19px 0 0; color: var(--lp-slate); font-size: 15px; line-height: 1.68; }.lp-cta-art { position: relative; display: flex; align-items: center; min-height: 350px; overflow: hidden; background: #eaf2ff; padding: 44px; }.lp-cta-orb { position: absolute; top: -80px; right: -65px; width: 240px; height: 240px; border-radius: 0 0 0 150px; background: var(--lp-blue); }.lp-ready-card { position: relative; width: min(270px,100%); border: 1px solid #cfe0ff; border-radius: 17px; background: #fff; padding: 24px; box-shadow: 0 24px 48px -30px rgba(37,99,235,.48); animation: lp-card-enter .8s .2s both; }.lp-ready-card h3 { margin: 20px 0 0; font-size: 18px; letter-spacing: -.035em; }.lp-ready-card p { margin: 9px 0 0; color: var(--lp-slate); font-size: 13px; line-height: 1.55; }.lp-ready-card span { display: flex; align-items: center; gap: 6px; margin-top: 19px; color: #1d4ed8; font-size: 11px; font-weight: 700; }
  .lp-footer { border-top: 1px solid var(--lp-line); padding: 30px 0; }.lp-footer-in { display: flex; align-items: center; justify-content: space-between; gap: 20px; color: #667085; font-size: 12px; }.lp-footer-brand { display: inline-flex; align-items: center; gap: 6px; color: #344054; font-weight: 700; }.lp-footer-brand i { display: grid; width: 24px; height: 24px; place-items: center; }.lp-link-button { color: var(--lp-ink); font-size: 12px; font-weight: 700; }
  @keyframes lp-enter { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes lp-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
  @keyframes lp-note-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes lp-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .45; transform: scale(.72); } }
  @keyframes lp-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes lp-card-enter { from { opacity: 0; transform: translateY(18px) rotate(-2deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
  @keyframes lp-status { 0%, 100% { box-shadow: 0 0 0 0 rgba(96,165,250,.42); } 40% { box-shadow: 0 0 0 5px rgba(96,165,250,0); } }
  @keyframes lp-flow-signal { 0%, 20% { transform: translateX(0); opacity: 0; } 28% { opacity: 1; } 62% { transform: translateX(390%); opacity: 1; } 72%, 100% { transform: translateX(390%); opacity: 0; } }
  @keyframes lp-flow-node { from { opacity: 0; transform: scale(.78) translateY(7px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @media (max-width: 920px) { .lp-hero { padding: 74px 0 80px; }.lp-hero-grid, .lp-dark .lp-section, .lp-cta-box, .lp-story-grid { grid-template-columns: 1fr; }.lp-hero-grid { gap: 55px; }.lp-preview-wrap { max-width: 690px; }.lp-section-head { grid-template-columns: 1fr; gap: 20px; }.lp-principles { grid-template-columns: repeat(2,1fr); }.lp-principle:first-child { grid-row: auto; }.lp-story { min-height: 0; padding: 84px 0; }.lp-story-grid { min-height: 0; gap: 42px; }.lp-story-copy { max-width: 650px; }.lp-story-stage { min-height: 430px; }.lp-story-panel:first-child { opacity: 1; visibility: visible; }.lp-story-panel:not(:first-child) { display: none; }.lp-cta-art { min-height: 280px; }.lp-cta-copy { padding: 42px; } }
  @media (max-width: 680px) { .lp-shell { width: min(100% - 32px, 1280px); }.lp-header { height: 64px; }.lp-nav, .lp-text-button { display: none; }.lp-header-actions { gap: 0; }.lp-header .lp-primary { min-height: 38px; padding: 0 12px; font-size: 12px; }.lp-hero { padding: 54px 0 70px; }.lp-title { font-size: clamp(42px, 12vw, 58px); }.lp-subtitle { font-size: 16px; }.lp-preview-content { grid-template-columns: 1fr; }.lp-evidence { display: none; }.lp-float-note { left: 10px; bottom: -17px; }.lp-rail-in { gap: 14px; padding: 13px 0; line-height: 1.4; }.lp-rail-in > b { width: 100%; }.lp-section, .lp-cta { padding: 72px 0; }.lp-section-head { padding-bottom: 32px; }.lp-section-flow { min-height: auto; }.lp-flow-visual { display: none; }.lp-workflows { grid-template-columns: 1fr; }.lp-workflow { min-height: 0; padding: 25px; }.lp-workflow h3 { margin-top: 27px; font-size: 25px; }.lp-story { padding: 72px 0; }.lp-story-grid { gap: 30px; }.lp-story-copy h2 { font-size: clamp(38px, 11vw, 52px); }.lp-story-stage { min-height: 490px; }.lp-story-panel { inset: 3% 0 0; }.lp-story-panel-body { grid-template-columns: 1fr; }.lp-story-pane--dark { display: none; }.lp-dark .lp-section { gap: 36px; }.lp-principles { grid-template-columns: 1fr; grid-template-rows: auto; }.lp-principle { min-height: 0; }.lp-principle:first-child { grid-row: auto; }.lp-principle-index { margin-top: 30px; }.lp-cta-copy, .lp-cta-art { padding: 31px; }.lp-cta-art { min-height: 245px; }.lp-footer-in { align-items: flex-start; flex-direction: column; gap: 13px; } }
  @media (prefers-reduced-motion: reduce) { .fitcv-landing *, .fitcv-landing *::before, .fitcv-landing *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; }.fitcv-landing .lp-story-panel { position: relative; inset: auto; opacity: 1; visibility: visible; }.fitcv-landing .lp-story-panel:not(:first-child) { display: none; } }
`

const seekerSteps = ["Upload the CV you already have", "Paste a role you want to pursue", "See evidence, gaps, and next steps"]
const recruiterSteps = ["Bring a job description or screening criteria", "Review CV evidence beside every score", "Shortlist deliberately with a clear review trail"]

function Workflow({ accent, icon, label, title, copy, steps }: { accent?: "orange"; icon: ReactNode; label: string; title: string; copy: string; steps: string[] }) {
  return <article className={`lp-workflow ${accent ?? ""}`}>
    <div className="lp-workflow-top"><span className="lp-workflow-icon">{icon}</span><span className="lp-workflow-label">{label}</span></div>
    <h3>{title}</h3><p>{copy}</p>
    <ol>{steps.map((step, index) => <li key={step}><b>0{index + 1}</b><span>{step}</span></li>)}</ol>
  </article>
}

export default function LandingScreen({ onGetStarted }: LandingScreenProps) {
  const landingRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  useGSAP(() => {
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

        const intro = gsap.timeline({
          defaults: { ease: "power3.out" },
        })
        intro
          .from(".lp-header", { y: -18, autoAlpha: 0, duration: 0.55 })
          .from(".lp-kicker", { y: 16, autoAlpha: 0, duration: 0.45 }, "-=0.2")
          .from(
            ".lp-title-line > span",
            { yPercent: 110, autoAlpha: 0, duration: 0.72, stagger: 0.1, ease: "power4.out" },
            "-=0.2",
          )
          .from(".lp-subtitle", { y: 18, autoAlpha: 0, duration: 0.55 }, "-=0.36")
          .from(".lp-hero-actions", { y: 16, autoAlpha: 0, duration: 0.5 }, "-=0.28")
          .from(".lp-note", { y: 10, autoAlpha: 0, duration: 0.4 }, "-=0.26")
          .from(
            ".lp-preview",
            { y: 34, rotateY: -5, autoAlpha: 0, duration: 0.85 },
            "-=0.62",
          )
          .from(
            ".lp-float-note",
            { x: -18, y: 14, autoAlpha: 0, duration: 0.45 },
            "-=0.35",
          )
          .from(
            ".lp-progress > i",
            { scaleX: 0, transformOrigin: "left center", duration: 0.65 },
            "-=0.25",
          )

        gsap.timeline({ delay: 0.25, defaults: { ease: "power2.out" } })
          .to(".lp-preview", { y: -8, duration: 1.1 })
          .to(".lp-preview", { y: 0, duration: 1.1, ease: "power2.inOut" })
        gsap.timeline({ delay: 0.42, defaults: { ease: "power2.out" } })
          .to(".lp-float-note", { y: -6, duration: 0.9 })
          .to(".lp-float-note", { y: 0, duration: 0.9, ease: "power2.inOut" })

        const revealSections = gsap.utils.toArray<HTMLElement>(".lp-reveal")
        revealSections.forEach((section) => {
          const pieces = section.querySelectorAll<HTMLElement>(
            ".lp-section-head, .lp-workflows, .lp-principles, .lp-cta-box",
          )
          const targets = pieces.length ? pieces : [section]
          gsap.from(targets, {
            y: 32,
            autoAlpha: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power3.out",
            immediateRender: false,
            scrollTrigger: {
              trigger: section,
              start: "top 84%",
              once: true,
            },
          })
        })

        if (!desktop) return

        const panels = gsap.utils.toArray<HTMLElement>(".lp-story-panel")
        const steps = gsap.utils.toArray<HTMLElement>(".lp-story-step")
        gsap.set(panels, { autoAlpha: 0, y: 34, scale: 0.96 })
        gsap.set(steps, { color: "#667085" })

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
              index === 0 ? 0 : ">-0.15",
            )
            .to(
              steps[index],
              {
                color: "#101828",
                backgroundColor: "rgba(255,255,255,.82)",
                borderColor: "#cfe0ff",
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
                steps[index],
                {
                  color: "#667085",
                  backgroundColor: "transparent",
                  borderColor: "transparent",
                  duration: 0.24,
                },
                "<",
              )
          }
        })
      },
    )
    return () => media.revert()
  }, { scope: landingRef })
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>(".lp-hero")
    if (!hero) return
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-70px 0px 0px" },
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [])
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })

  return <div ref={landingRef} className="fitcv-landing">
    <style>{landingCss}</style>
    <header className={`lp-header ${scrolled ? "is-scrolled" : ""}`}><div className="lp-shell lp-header-in">
      <button className="lp-brand" onClick={() => scrollTo("top")} aria-label="FitCV home"><span className="lp-brand-mark"><BrandMark size={32} /></span>FitCV</button>
      <nav className="lp-nav" aria-label="Landing navigation"><button onClick={() => scrollTo("workflows")}>How it works</button><button onClick={() => scrollTo("story")}>See the story</button><button onClick={() => scrollTo("principles")}>Why FitCV</button><button onClick={() => scrollTo("start")}>For teams</button></nav>
      <div className="lp-header-actions"><button className="lp-text-button" onClick={onGetStarted}>Sign in</button><button className="lp-primary" onClick={onGetStarted}>Start with FitCV <ArrowRight size={14} weight="bold" /></button></div>
    </div></header>

    <main id="top">
      <section className="lp-hero"><div className="lp-shell lp-hero-grid">
        <div><span className="lp-kicker"><Sparkle size={13} weight="fill" />Evidence-first career intelligence</span><h1 className="lp-title" aria-label="Your next role should not be a guess."><span className="lp-title-line"><span>Your next role should</span></span><span className="lp-title-line"><span>not be a guess.</span></span></h1><p className="lp-subtitle">FitCV turns a CV and job description into a clear, reviewable picture of fit, so the next decision starts with evidence.</p><div className="lp-hero-actions"><button className="lp-primary blue" onClick={onGetStarted}>Start with FitCV <ArrowRight size={16} weight="bold" /></button><button className="lp-secondary" onClick={() => scrollTo("workflows")}>Explore the workflow</button></div><p className="lp-note">For applicants and hiring teams. PDF and DOCX supported.</p></div>
        <div className="lp-preview-wrap"><div className="lp-preview"><div className="lp-preview-top"><div className="lp-mini-brand"><i className="lp-mini-icon"><BrandMark size={26} /></i><span><strong>CV & JD Match</strong><small>Analysis complete</small></span></div><b className="lp-ready">Evidence ready</b></div><div className="lp-preview-content"><div className="lp-profile-card"><div className="lp-profile-head"><div className="lp-mini-profile"><i className="lp-avatar"><User size={18} weight="bold" /></i><span><strong>Candidate profile</strong><small>Software Engineering</small></span></div><ArrowUpRight className="lp-open-icon" size={15} /></div><div className="lp-progress-block"><div className="lp-row"><label>Role alignment</label><span>82%</span></div><div className="lp-progress"><i /></div></div><div className="lp-chips"><span>React</span><span>TypeScript</span><span>SQL</span><span>Git</span><span>+3 matched</span></div><div className="lp-tip"><b>Worth reviewing:</b> add deployment evidence for this role.</div></div><div className="lp-evidence"><div className="lp-evidence-head"><span><strong>Match evidence</strong><small>Frontend Developer Intern</small></span><b className="lp-score">82<small>/100</small></b></div><div className="lp-evidence-list">{[["Skills", "Strong", ""], ["Experience", "Partial", "orange"], ["Education", "Relevant", "green"]].map(([label, value, color]) => <div className="lp-evidence-line" key={label}><span>{label}</span><b><i className={`lp-state-dot ${color}`} />{value}</b></div>)}</div><div className="lp-source"><CheckCircle size={12} weight="fill" />Source-grounded review</div></div></div></div><div className="lp-float-note"><b>Clear next action</b><span>Add one project outcome</span></div></div>
      </div></section>
      <section id="workflows" className="lp-section lp-reveal"><div className="lp-shell"><div className="lp-section-head"><div className="lp-section-flow"><span className="lp-eyebrow">One platform, two perspectives</span><div className="lp-flow-visual" aria-label="Job seeker workflow"><i className="lp-flow-rail" /><i className="lp-flow-node"><FileText size={17} weight="bold" /></i><i className="lp-flow-node engine"><Sparkle size={17} weight="fill" /></i><i className="lp-flow-node review"><CheckCircle size={17} weight="fill" /></i><span className="lp-flow-caption one">CV & JD</span><span className="lp-flow-caption two">Analyze</span><span className="lp-flow-caption three">Review</span></div><div className="lp-flow-visual hr" aria-label="Hiring team workflow"><i className="lp-flow-rail" /><i className="lp-flow-node"><FileText size={17} weight="bold" /></i><i className="lp-flow-node engine"><ChartBar size={17} weight="bold" /></i><i className="lp-flow-node review"><CheckCircle size={17} weight="fill" /></i><span className="lp-flow-caption one">JD & CVs</span><span className="lp-flow-caption two">Rank</span><span className="lp-flow-caption three">Pipeline</span></div></div><div><h2 className="lp-section-title">Make the next move easier to explain.</h2><p className="lp-section-copy">One shared, source-grounded engine gives job seekers useful next steps and hiring teams defensible candidate review.</p></div></div><div className="lp-workflows"><Workflow icon={<User size={21} weight="bold" />} label="For job seekers" title="Know what to strengthen before you apply." copy="See how your current CV maps to a real role, without needing to decipher a black-box score." steps={seekerSteps} /><Workflow accent="orange" icon={<Briefcase size={21} weight="bold" />} label="For hiring teams" title="Review candidates with context, not clutter." copy="Bring in external CVs or applications already in FitCV and keep screening discussions anchored in evidence." steps={recruiterSteps} /></div></div></section>
      <section id="story" className="lp-story" aria-labelledby="story-title"><div className="lp-shell lp-story-grid"><div className="lp-story-copy"><span className="lp-eyebrow">See the signal</span><h2 id="story-title">From raw CV to a clearer next step.</h2><p>Scroll through the same review journey your users will experience. Each step keeps the source close to the decision.</p><div className="lp-story-steps"><span className="lp-story-step is-active" data-story-step="0"><b>01</b><span>Bring in a CV and a real role</span></span><span className="lp-story-step" data-story-step="1"><b>02</b><span>See the evidence behind the match</span></span><span className="lp-story-step" data-story-step="2"><b>03</b><span>Choose the next action with context</span></span></div></div><div className="lp-story-stage" aria-label="FitCV workflow preview"><article className="lp-story-panel" data-story-panel="0"><div className="lp-story-panel-top"><span className="lp-story-panel-title"><FileText size={17} weight="bold" /> CV and role ready</span><span className="lp-story-status">Parsed</span></div><div className="lp-story-panel-body"><div className="lp-story-pane"><h3>Frontend Developer Intern</h3><p>React, TypeScript, SQL, and deployment experience are visible in the role brief.</p><div className="lp-story-meter"><i /></div><div className="lp-story-checks"><span className="lp-story-check"><span>CV text extracted</span><b><CheckCircle size={13} weight="fill" /> Ready</b></span><span className="lp-story-check"><span>Role requirements mapped</span><b><CheckCircle size={13} weight="fill" /> Ready</b></span></div></div><div className="lp-story-pane lp-story-pane--dark"><h3>Source context</h3><p>Every recommendation stays connected to the CV or job description it came from.</p><div className="lp-story-evidence"><div><span>Skills</span><b>12 found</b></div><div><span>Experience</span><b>4 signals</b></div><div><span>Education</span><b>Relevant</b></div></div></div></div></article><article className="lp-story-panel" data-story-panel="1"><div className="lp-story-panel-top"><span className="lp-story-panel-title"><Sparkle size={17} weight="fill" /> Match evidence</span><span className="lp-story-status">Reviewable</span></div><div className="lp-story-panel-body"><div className="lp-story-pane lp-story-pane--dark"><h3>Role alignment</h3><div className="lp-story-score">82<small>/100</small></div><p>Strong match with one gap worth addressing before you apply.</p></div><div className="lp-story-pane"><h3>Why this score</h3><p>Evidence is grouped by the things that matter to this role.</p><div className="lp-story-checks"><span className="lp-story-check"><span>Technical skills</span><b><CheckCircle size={13} weight="fill" /> Strong</b></span><span className="lp-story-check"><span>Experience</span><b><CheckCircle size={13} weight="fill" /> Partial</b></span><span className="lp-story-check"><span>Education</span><b><CheckCircle size={13} weight="fill" /> Relevant</b></span></div><div className="lp-story-message"><b>Worth reviewing:</b> add one deployment outcome from a real project.</div></div></div></article><article className="lp-story-panel lp-story-panel--orange" data-story-panel="2"><div className="lp-story-panel-top"><span className="lp-story-panel-title"><ShieldCheck size={17} weight="bold" /> Human review</span><span className="lp-story-status">In control</span></div><div className="lp-story-panel-body"><div className="lp-story-pane"><h3>Next action</h3><p>Turn the review into something useful, whether you are applying or hiring.</p><div className="lp-story-checks"><span className="lp-story-check"><span>Save improvement suggestion</span><b><CheckCircle size={13} weight="fill" /> Done</b></span><span className="lp-story-check"><span>Open application tracker</span><b><CheckCircle size={13} weight="fill" /> Ready</b></span></div></div><div className="lp-story-pane lp-story-pane--dark"><h3>Review trail</h3><p>FitCV supports judgment. It never auto-accepts or rejects a person.</p><div className="lp-story-message"><b>Decision aid:</b> keep the source, the context, and the next step together.</div></div></div></article></div></div></section>
      <section id="principles" className="lp-dark lp-reveal"><div className="lp-shell lp-section"><div><span className="lp-eyebrow">What makes it useful</span><h2 className="lp-section-title">AI is more helpful when you can check its work.</h2><p className="lp-section-copy">FitCV is designed to make the review more rigorous, not to replace the reviewer.</p></div><div className="lp-principles">{[[<MagnifyingGlass size={20} weight="bold" />, "Evidence, not guesses", "Skills, education, and experience are shown with the source text that supports them."], [<ChartBar size={20} weight="bold" />, "One shared language", "Job seekers and hiring teams see the same match logic, with context for their workflow."], [<ShieldCheck size={20} weight="bold" />, "A decision aid, not a verdict", "FitCV surfaces information for review. It never auto-accepts or rejects a person."]].map(([icon, title, body], index) => <article className="lp-principle" key={String(title)}><span className="lp-principle-icon">{icon as ReactNode}</span><b className="lp-principle-index">0{index + 1}</b><h3>{title as string}</h3><p>{body as string}</p></article>)}</div></div></section>
      <section id="start" className="lp-cta lp-reveal"><div className="lp-shell"><div className="lp-cta-box"><div className="lp-cta-copy"><span className="lp-eyebrow">Start where you are</span><h2>A stronger CV review starts with the actual CV.</h2><p>Upload a document, bring a job description, and get a structured view of what is already there, plus what deserves attention next.</p><button className="lp-primary" style={{ marginTop: 29 }} onClick={onGetStarted}>Start with FitCV <ArrowRight size={16} weight="bold" /></button></div><div className="lp-cta-art"><i className="lp-cta-orb" /><div className="lp-ready-card"><Sparkle size={19} className="lp-blue-icon" weight="fill" color="#2563eb" /><h3>Ready to review</h3><p>Bring a CV and a role. We will organize the evidence for you.</p><span><CheckCircle size={14} weight="fill" />PDF & DOCX accepted</span></div></div></div></div></section>
    </main>
    <footer className="lp-footer"><div className="lp-shell lp-footer-in"><span className="lp-footer-brand"><i><BrandMark size={24} /></i>FitCV</span><span>Career decisions, made more reviewable.</span><button className="lp-link-button" onClick={onGetStarted}>Start with FitCV</button></div></footer>
  </div>
}
