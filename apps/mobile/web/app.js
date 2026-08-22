import { createMotionEngine } from '/shared/motion-core.js';

const status = document.querySelector('#status'); const connectButton = document.querySelector('#connect'); const calibrateButton = document.querySelector('#calibrate'); const disconnectButton = document.querySelector('#disconnect');
const pairingToken = new URLSearchParams(location.search).get('token'); const deviceId = localStorage.motionMouseDeviceId ?? crypto.randomUUID(); localStorage.motionMouseDeviceId = deviceId;
let socket; let sessionId; let sequence = 0; let heartbeat; let reconnectTimer; let enabled = false; const engine = createMotionEngine();
const screenOrientation = () => ({ 0: 'portrait', 90: 'landscape-left', '-90': 'landscape-right', 180: 'portrait-upside-down' }[screen.orientation?.angle] ?? 'portrait');
const write = (kind, payload) => { if (socket?.readyState !== WebSocket.OPEN || !sessionId) return false; socket.send(JSON.stringify({ v: 1, kind, sessionId, seq: ++sequence, sentAtMs: Date.now(), payload })); return true; };
const setStatus = (value) => { status.textContent = value; };

async function requestMotionPermission() {
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') { const result = await DeviceOrientationEvent.requestPermission(); if (result !== 'granted') throw new Error('motion permission denied'); }
}
function openSocket() {
  if (!pairingToken) throw new Error('missing pairing token');
  socket = new WebSocket(`wss://${location.host}/ws`);
  socket.onopen = () => { sequence = 0; socket.send(JSON.stringify({ v: 1, kind: 'session.hello', seq: sequence, sentAtMs: Date.now(), payload: { deviceId, pairingToken } })); setStatus('Connected; awaiting session acknowledgement'); };
  socket.onmessage = (message) => { const event = JSON.parse(message.data); if (event.kind === 'session.ack') { sessionId = event.sessionId; enabled = true; calibrateButton.disabled = false; disconnectButton.disabled = false; setStatus('Connected. Tilt the phone to move.'); heartbeat = setInterval(() => write('session.heartbeat', {}), 1_000); } };
  socket.onclose = () => { clearInterval(heartbeat); sessionId = undefined; enabled = false; calibrateButton.disabled = true; disconnectButton.disabled = true; setStatus('Disconnected; reconnecting safely…'); if (connectButton.disabled) reconnectTimer = setTimeout(openSocket, 1_000); };
  socket.onerror = () => socket.close();
}
window.addEventListener('deviceorientation', (event) => {
  if (!enabled || event.alpha === null || event.beta === null || event.gamma === null) return;
  const output = engine.process({ timestampMs: Date.now(), attitude: { yaw: event.alpha * Math.PI / 180, pitch: event.beta * Math.PI / 180, roll: event.gamma * Math.PI / 180 }, displayOrientation: screenOrientation() });
  if (output && (output.deltaX !== 0 || output.deltaY !== 0)) write('pointer.delta', { dx: output.deltaX, dy: output.deltaY });
});
connectButton.onclick = async () => { try { await requestMotionPermission(); connectButton.disabled = true; openSocket(); } catch (error) { setStatus(`Cannot start: ${error.message}`); } };
calibrateButton.onclick = () => { engine.recenter(); write('calibrate', { action: 'recenter' }); setStatus('Re-centered'); };
disconnectButton.onclick = () => { clearTimeout(reconnectTimer); connectButton.disabled = false; socket?.close(1000, 'user disconnect'); setStatus('Disconnected'); };
