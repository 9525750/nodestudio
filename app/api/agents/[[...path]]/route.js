import { NextResponse } from 'next/server';

const KIE_BASE = 'https://api.kie.ai';

function getApiKey(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        if (token) return token;
    }
    const headerKey = request.headers.get('x-api-key');
    return headerKey || null;
}

function cleanHeaders(request) {
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('cookie');
    headers.delete('authorization');
    headers.delete('x-api-key');
    return headers;
}

function buildTargetUrl(pathSegments, search) {
    const path = pathSegments.join('/');
    const base = `${KIE_BASE}/agents`;
    return path ? `${base}/${path}${search}` : `${base}${search}`;
}

export async function GET(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

    try {
        const response = await fetch(targetUrl, { headers, method: 'GET' });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

    try {
        const body = await request.arrayBuffer();
        const response = await fetch(targetUrl, { method: 'POST', headers, body });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

    try {
        const response = await fetch(targetUrl, { method: 'DELETE', headers });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    const slug = await params;
    const pathSegments = slug.path || [];
    const { search } = new URL(request.url);
    const targetUrl = buildTargetUrl(pathSegments, search);

    const headers = cleanHeaders(request);
    const apiKey = getApiKey(request);
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);

    try {
        const body = await request.arrayBuffer();
        const response = await fetch(targetUrl, { method: 'PUT', headers, body });
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
