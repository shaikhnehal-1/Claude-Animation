# Run the Doom studio on your Windows PC

Your PC's graphics card renders this video **20 to 50 times faster** than the cloud machine.
You only do Steps 1 to 4 once.

---

## Step 1: Install 3 free programs

Install each one with the default options (keep clicking **Next**).

1. **Node.js (LTS)**: https://nodejs.org (the big green "LTS" button)
2. **Git**: https://git-scm.com/download/win
3. **Python 3**: https://www.python.org/downloads/
   On the first screen, **tick "Add python.exe to PATH"** before you click Install.

Then **restart your PC** so Windows picks up the new programs.

---

## Step 2: Download the project

1. Open the **Start menu**, type `cmd` and open **Command Prompt**.
2. Copy and paste these lines one at a time, pressing Enter after each:

```
cd %USERPROFILE%\Documents
git clone https://github.com/shaikhnehal-1/Claude-Animation.git
cd Claude-Animation
git checkout claude/youtube-threejs-animation-2btfue
```

If Git asks you to sign in, sign in with your GitHub account.

---

## Step 3: Install the studio (about 2 minutes)

```
cd studio
npm install
cd ..
```

---

## Step 4: Download the free 3D assets (skies, stone, wood, props, about 90 MB)

```
python tools\get_assets.py
```

At the end it prints `All assets ready.`

---

## Step 5: Watch it live in your browser

```
cd studio
npm run preview
```

Your browser opens **Remotion Studio**. Pick a video on the left, press **Space** to play,
and drag the timeline to scrub through it. Leave this window open while you watch.
To stop it, click the Command Prompt window and press **Ctrl + C**.

---

## Step 6: Render the final video file

Open a **second** Command Prompt window, then:

```
cd %USERPROFILE%\Documents\Claude-Animation\studio
npx remotion render src/index.ts StyleTest out/style-test.mp4
```

The finished video appears in `Documents\Claude-Animation\studio\out\`.
For the real episode, I'll give you the exact command (for example `Part1`) when it is ready.

---

## Every time I tell you "new version pushed"

```
cd %USERPROFILE%\Documents\Claude-Animation
git pull
python tools\get_assets.py
cd studio
npm install
npm run preview
```

`get_assets.py` and `npm install` finish in seconds when nothing new is needed.

---

## If something goes wrong

- **`'node' is not recognized` / `'python' is not recognized`**: restart the PC.
  For Python, reinstall it with **"Add python.exe to PATH"** ticked.
- **Render is slow, or the picture is black**: update your graphics driver (NVIDIA GeForce Experience,
  AMD Adrenalin, or Intel Driver Assistant). Then add `--gl=angle` at the end of the render command.
- **Anything else**: copy the red error text and send it to me.
