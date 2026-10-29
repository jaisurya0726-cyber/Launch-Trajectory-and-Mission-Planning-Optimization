import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Gemini Chat Endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages,
        model = 'gemini-3.8-flash',
        role = 'aerospace',
        missionContext,
        customInstruction,
      } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Messages array is required.' });
      }

      // Valid model enforcement
      const allowedModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-4-argon'];
      const selectedModel = allowedModels.includes(model) ? model : 'gemini-3.8-flash';

      // Build specialized system instruction based on role & mission context
      let rolePrompt = 'You are the AeroQuantum Mission & Quantum Computing Intelligence Specialist.';
      if (role === 'quantum') {
        rolePrompt = 'You are a Quantum Computing & Mathematical Optimization Specialist focusing on QUBO matrices, Ising spin glasses, QAOA quantum circuit statevectors, error correction codes (Surface & Steane), and quantum fidelity.';
      } else if (role === 'aerodynamics') {
        rolePrompt = 'You are an Aerospace Flight Dynamics & Propulsion Specialist focusing on Tsiolkovsky rocket equation, 4th-order Runge-Kutta numerical trajectories, aerodynamic drag, Max-Q load, and atmospheric hypersonic re-entry heat shields (Sutton-Graves stagnation heat flux, TPS ablation).';
      } else if (role === 'risk') {
        rolePrompt = 'You are a Launch Safety & Mission Risk Director evaluating launch weather criteria, risk matrices, structural safety factors, launch windows, and probability of mission failure.';
      }

      let contextStr = '';
      if (missionContext) {
        contextStr = `\n\nCURRENT TELEMETRY CONTEXT:\n- Mission ID: ${missionContext.mission_id || 'N/A'}\n- Satellite: ${missionContext.satellite_name || 'N/A'}\n- Launch Vehicle: ${missionContext.rocket || 'N/A'}\n- Target Orbit: ${missionContext.target_orbit || 'N/A'} at ${missionContext.altitude || 0} km\n- Payload Mass: ${missionContext.payload_mass || 0} kg\n- Required Delta-V: ${missionContext.delta_v || 0} km/s\n- Specific Impulse: ${missionContext.specific_impulse || 0} s\n- Thrust: ${missionContext.thrust || 0} kN\n- Safety Status: ${missionContext.safety_status || 'NOMINAL'}\n- Risk Score: ${missionContext.risk_score || 0}\n- Trajectory Type: ${missionContext.trajectory_type || 'Direct Ascent'}`;
      }

      const fullSystemInstruction = `${rolePrompt}\nYou provide clear, mathematically precise, scientifically accurate, and helpful answers for engineers, researchers, and mission directors using the AeroQuantum platform. When discussing formulas, use clean notation. When discussing code, reference Python 3 / NumPy / SciPy / Qiskit or modern scientific TypeScript. Be concise, authoritative, and direct.${contextStr}${customInstruction ? `\n\nAdditional Guidance: ${customInstruction}` : ''}`;

      // Convert messages to @google/genai contents format
      const contents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: {
          systemInstruction: fullSystemInstruction,
        },
      });

      const replyText = response.text || 'No response generated.';

      return res.json({
        reply: replyText,
        model: selectedModel,
        usage: response.usageMetadata,
      });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      const errorMessage = err?.message || 'Failed to generate response from Gemini.';
      return res.status(500).json({
        error: errorMessage,
      });
    }
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
