import { NextResponse } from 'next/server';
import { getLocaleFromPathname } from './lib/locales';

function addSecurityHeaders(response) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; connect-src 'self' https://kie.ai https://*.kie.ai https://kieai.redpandaai.co https://muapi.ai https://*.muapi.ai; font-src 'self' data:;"
    );
    return response;
}

export function middleware(request) {
    const url = request.nextUrl;

    const isApiProxy = url.pathname.startsWith('/api/workflow') ||
                    url.pathname.startsWith('/api/app') ||
                    url.pathname.startsWith('/api/v1');

    if (isApiProxy) {
        const isHandledByRoute = url.pathname.startsWith('/api/v1/creative-agent') ||
                                url.pathname.startsWith('/api/v1/get_upload_url') ||
                                url.pathname.startsWith('/api/v1/upload-binary');

        if (url.pathname.startsWith('/api/v1') && !isHandledByRoute) {
            const targetUrl = new URL(url.pathname + url.search, 'https://api.kie.ai');
            const rewriteResponse = NextResponse.rewrite(targetUrl);
            return addSecurityHeaders(rewriteResponse);
        }
    }

    const response = NextResponse.next();
    response.headers.set('x-locale', getLocaleFromPathname(url.pathname));
    return addSecurityHeaders(response);
}

export const config = {
    matcher: [
        '/api/:path*',
        '/((?!_next/static|_next/image|favicon.ico|__nextjs_original-stack-frame).*)',
    ],
};
