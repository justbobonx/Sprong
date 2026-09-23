# SPRONG

Two-player tap tennis on one screen. No paddles. The shockwave is the paddle.

Open `index.html` on a phone. Landscape splits left/right. Portrait splits top/bottom.

## Play

- Neon line splits the wide axis. That is the net.
- Chevron points at the server.
- Server taps once to toss (square grows = height).
- Server taps again to serve. Closer to the top of the toss parabola = faster.
- Any tap fires a boom from r=0 out to 350px.
- When that ring reaches the square, the return is geometry: current ball direction, tap-to-ball direction, distance. Result is forced back across the net.
- Past the back line is a point. Winner serves next.

Clicks work for desktop checks. This is a mobile game.
