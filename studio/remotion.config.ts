import fs from 'fs';
import {Config} from '@remotion/cli/config';

// Cloud machine (no GPU): use the pre-installed headless Chrome + software GL.
// Your own PC: Remotion downloads its own Chrome and renders on your graphics card (ANGLE).
const CLOUD_CHROME = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';

if (fs.existsSync(CLOUD_CHROME)) {
  Config.setBrowserExecutable(CLOUD_CHROME);
  Config.setChromiumOpenGlRenderer('swiftshader');
} else {
  Config.setChromiumOpenGlRenderer('angle');
}

Config.setDelayRenderTimeoutInMilliseconds(120000);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
