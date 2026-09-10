import AuroraBackground from './AuroraBackground';
import './AuroraDemo.css';

/**
 * Demo host for AuroraBackground — a stand-in for the DeepConvergeAI landing
 * page, here only to prove the layer sits behind real content and that text
 * stays selectable and links stay clickable over it.
 */
export default function AuroraDemo() {
  return (
    <>
      <AuroraBackground />

      <div className="demo">
        <header className="demo__bar">
          <span className="demo__mark">DeepConvergeAI</span>
          <nav className="demo__nav">
            <a href="#research">Research</a>
            <a href="#platform">Platform</a>
            <a href="#company">Company</a>
          </nav>
        </header>

        <main className="demo__hero">
          <p className="demo__eyebrow">Frontier alignment research</p>
          <h1 className="demo__title">
            Systems that converge
            <br />
            on human intent.
          </h1>
          <p className="demo__lede">
            We build interpretable models and the evaluation infrastructure that keeps them
            honest at scale.
          </p>
          <div className="demo__actions">
            <a className="demo__cta" href="#research">
              Read the research
            </a>
            <a className="demo__ghost" href="#platform">
              Platform overview
            </a>
          </div>
        </main>

        <footer className="demo__foot">
          <span>Move the cursor — the blob trails it.</span>
        </footer>
      </div>
    </>
  );
}
