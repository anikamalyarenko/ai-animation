import AuroraBackground from './AuroraBackground';
import './AuroraDemo.css';

/**
 * Fixed-size preview: the animated background at exactly 1440x854 and nothing
 * else — no copy, no chrome. The stage does not scale with the viewport; on a
 * narrower window the page scrolls to it.
 *
 * For the responsive full-viewport background layer, drop the width/height
 * props and render <AuroraBackground /> behind your own content instead.
 */
const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 854;

export default function AuroraDemo() {
  return <AuroraBackground width={STAGE_WIDTH} height={STAGE_HEIGHT} />;
}
