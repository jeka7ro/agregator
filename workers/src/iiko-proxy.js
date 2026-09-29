import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const IIKO_BASE = 'https://api-eu.syrve.live/api/1';
const SYRVE_BASE = 'https://api-eu.syrve.live/api/1';

app.post('/api/syrve/*', async (req, res) => {
    const endpoint = req.params[0];
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const response = await fetch(`${SYRVE_BASE}/${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/iiko/*', async (req, res) => {
    const endpoint = req.params[0];
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) headers['Authorization'] = authHeader;

        const response = await fetch(`${IIKO_BASE}/${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/nomenclature?orgId=xxx  — returns products + groups with imageLinks
app.get('/api/nomenclature', async (req, res) => {
    const { orgId } = req.query;
    if (!orgId) return res.status(400).json({ error: 'orgId is required' });

    try {
        // Step 1: get auth token
        const tokenResp = await fetch(`${IIKO_BASE}/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiLogin: 'a1fe30cdeb934aa0af01b6a35244b7f0' })
        });
        if (!tokenResp.ok) return res.status(502).json({ error: 'iiko auth failed' });
        const { token } = await tokenResp.json();

        // Step 2: fetch nomenclature
        const nomResp = await fetch(`${IIKO_BASE}/nomenclature`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organizationId: orgId })
        });
        if (!nomResp.ok) return res.status(502).json({ error: 'iiko nomenclature failed' });
        const nomData = await nomResp.json();

        // Return products and groups (both have imageLinks)
        res.json({
            products: (nomData.products || []).filter(p => p.imageLinks?.length > 0 || p.name),
            groups: (nomData.groups || []).filter(g => g.imageLinks?.length > 0 || g.name)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(3005, () => console.log('🚀 Gateway-ul de iiko (Proxy) a pornit pe portul 3005 fara probleme de CORS!'));
