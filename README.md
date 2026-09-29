# Ludo

**Classic Ludo for 2 to 4 players, made by Vivek.** Play friends online with a 4-letter room code, pass one device around, or take on the computer. Works on any phone, tablet or computer. No app, no sign-up.

**Play:** https://ranjanvivek047-bot.github.io/ludo/

## How to play

1. Each player has 4 pawns waiting in their yard. Roll a **6** to bring a pawn out onto your start square.
2. Move clockwise around the board by the number you roll, then up your own coloured path to the centre.
3. Land on a rival's pawn to send it back to their yard, except on the star squares and start squares, which are safe.
4. A **6** gives you another roll, and so does capturing a pawn or getting one home. Three 6s in a row ends your turn.
5. You need the exact number to reach home. The first player to get all 4 pawns home wins.

## Ways to play

- **Online:** choose **Host a game**, share the room code or invite link, and friends join from their own devices. Refreshing keeps your seat, and extra visitors can watch.
- **Pass and play:** 2, 3 or 4 players on one device.
- **Vs computer:** you against 1 to 3 computer players.

## How it works

- A static site: plain HTML, CSS and JavaScript, no build step and no game server.
- Devices talk through public MQTT relays over secure WebSockets. The host's browser runs the game, rolls the die and checks every move, and everyone sees one shared board. A move that gets re-sent after a network hiccup is never applied twice.
- The rules live in `site/engine.js` as pure functions, so they are tested on their own.

## Run it locally

```bash
cd test
npm install
npm run serve        # http://localhost:8767
```

## Tests

```bash
cd test
npm test             # rules
npm run e2e          # online, pass and play, vs computer, and phone layouts in real browsers (needs Google Chrome)
```
