'use strict';

// 폰에서 실행하는 대용량 영상 서버입니다.
// 중요한 비밀번호나 Firebase 서비스 계정 파일은 절대로 GitHub에 올리지 않습니다.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');

const SERVER_DIR = __dirname;
const CONFIG_PATH = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(SERVER_DIR, 'server-config.json');
const ONE_GB = 1024 * 1024 * 1024;
const MAX_JSON_BYTES = 100 * 1024;
const UPLOAD_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/webm']);

function stopWithMessage(message) {
    console.error(`\n[서버 시작 실패] ${message}\n`);
    process.exit(1);
}

function readConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        stopWithMessage('server-config.json 파일이 없습니다. server-config.example.json을 복사한 뒤 내용을 채워 주세요.');
    }

    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (error) {
        stopWithMessage(`설정 파일을 읽을 수 없습니다: ${error.message}`);
    }
}

function normalizeConfig(raw) {
    const configDir = path.dirname(CONFIG_PATH);
    const config = {
        port: Number(raw.port || 8787),
        publicBaseUrl: String(raw.publicBaseUrl || '').replace(/\/$/, ''),
        storagePath: String(raw.storagePath || ''),
        firebaseProjectId: String(raw.firebaseProjectId || ''),
        allowedOrigins: Array.isArray(raw.allowedOrigins) ? raw.allowedOrigins : [],
        adminEmails: Array.isArray(raw.adminEmails) ? raw.adminEmails.map(email => String(email).toLowerCase()) : [],
        maxVideoSizeBytes: Number(raw.maxVideoSizeBytes || ONE_GB),
        chunkSizeBytes: Number(raw.chunkSizeBytes || 8 * 1024 * 1024),
        maxActiveUploadsPerUser: Number(raw.maxActiveUploadsPerUser || 2)
    };

    if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) stopWithMessage('port 값이 올바르지 않습니다.');
    if (!config.publicBaseUrl.startsWith('https://') && !config.publicBaseUrl.startsWith('http://')) stopWithMessage('publicBaseUrl은 http:// 또는 https://로 시작해야 합니다.');
    if (!config.storagePath) stopWithMessage('storagePath에 영상 저장 폴더를 적어 주세요.');
    if (!config.firebaseProjectId) stopWithMessage('firebaseProjectId에 Firebase 프로젝트 ID를 적어 주세요.');
    if (config.allowedOrigins.length === 0) stopWithMessage('allowedOrigins에 GitHub Pages 주소를 적어 주세요.');
    if (!Number.isSafeInteger(config.maxVideoSizeBytes) || config.maxVideoSizeBytes < 1 || config.maxVideoSizeBytes > ONE_GB) stopWithMessage('maxVideoSizeBytes는 1GB 이하의 정수여야 합니다.');
    if (!Number.isSafeInteger(config.chunkSizeBytes) || config.chunkSizeBytes < 5 * 1024 * 1024 || config.chunkSizeBytes > 50 * 1024 * 1024) stopWithMessage('chunkSizeBytes는 5MB~50MB 사이여야 합니다.');
    if (!Number.isInteger(config.maxActiveUploadsPerUser) || config.maxActiveUploadsPerUser < 1 || config.maxActiveUploadsPerUser > 5) stopWithMessage('maxActiveUploadsPerUser는 1~5 사이여야 합니다.');

    config.storagePath = path.resolve(configDir, config.storagePath);
    return config;
}

const config = normalizeConfig(readConfig());

const paths = {
    root: config.storagePath,
    partial: path.join(config.storagePath, '_partial'),
    sessions: path.join(config.storagePath, '_sessions'),
    media: path.join(config.storagePath, 'media')
};

function isSafeId(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value);
}

function sanitizeFileName(value) {
    const clean = String(value || 'video').replace(/[^a-zA-Z0-9가-힣._ -]/g, '_').trim();
    return clean.slice(0, 120) || 'video';
}

function fileExtension(name, mimeType) {
    if (mimeType === 'video/webm' || /\.webm$/i.test(name)) return '.webm';
    return '.mp4';
}

function sessionPath(id) { return path.join(paths.sessions, `${id}.json`); }
function partialPath(id) { return path.join(paths.partial, `${id}.part`); }
function metadataPath(id) { return path.join(paths.media, `${id}.json`); }

async function readJson(filePath) {
    return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}

async function writeJsonAtomic(filePath, value) {
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await fsp.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
    await fsp.rename(tempPath, filePath);
}

function sendJson(response, status, body) {
    const text = JSON.stringify(body);
    response.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(text),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    response.end(text);
}

function sendError(response, status, message) {
    sendJson(response, status, { error: message });
}

function applyCors(request, response) {
    const origin = request.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Content-Range');
        response.setHeader('Access-Control-Max-Age', '600');
    }
}

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

let firebaseKeyCache = { keys: null, expiresAt: 0 };

function decodeBase64Url(text) {
    const normalized = String(text).replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(normalized + '='.repeat((4 - normalized.length % 4) % 4), 'base64');
}

function parseJwtPart(text) {
    try {
        return JSON.parse(decodeBase64Url(text).toString('utf8'));
    } catch (_) {
        throw createHttpError(401, '로그인 정보를 읽을 수 없습니다. 다시 로그인해 주세요.');
    }
}

async function getFirebasePublicKeys() {
    if (firebaseKeyCache.keys && firebaseKeyCache.expiresAt > Date.now()) return firebaseKeyCache.keys;

    let response;
    try {
        response = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    } catch (_) {
        throw createHttpError(503, '로그인 확인 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    if (!response.ok) throw createHttpError(503, '로그인 확인 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');

    const keys = await response.json();
    const maxAgeMatch = /max-age=(\d+)/i.exec(response.headers.get('cache-control') || '');
    const maxAgeMs = Math.max(60, Number(maxAgeMatch && maxAgeMatch[1]) || 3600) * 1000;
    firebaseKeyCache = { keys, expiresAt: Date.now() + maxAgeMs };
    return keys;
}

async function verifyFirebaseIdToken(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw createHttpError(401, '로그인 정보 형식이 올바르지 않습니다.');

    const header = parseJwtPart(parts[0]);
    const payload = parseJwtPart(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    const expectedIssuer = `https://securetoken.google.com/${config.firebaseProjectId}`;
    const expiresAt = Number(payload.exp);
    const issuedAt = Number(payload.iat);
    if (header.alg !== 'RS256' || !header.kid || payload.aud !== config.firebaseProjectId || payload.iss !== expectedIssuer || !payload.sub || !Number.isSafeInteger(expiresAt) || !Number.isSafeInteger(issuedAt) || expiresAt <= now || issuedAt > now) {
        throw createHttpError(401, '로그인 시간이 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요.');
    }

    const keys = await getFirebasePublicKeys();
    const certificate = keys[header.kid];
    if (!certificate) {
        firebaseKeyCache.expiresAt = 0;
        throw createHttpError(401, '로그인 열쇠를 확인하지 못했습니다. 다시 로그인해 주세요.');
    }

    let verified = false;
    try {
        const publicKey = crypto.createPublicKey(certificate);
        verified = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, decodeBase64Url(parts[2]));
    } catch (_) {
        verified = false;
    }
    if (!verified) throw createHttpError(401, '로그인 확인에 실패했습니다. 다시 로그인해 주세요.');
    return payload;
}

async function getAuthenticatedUser(request) {
    const authorization = String(request.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) {
        throw createHttpError(401, '로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.');
    }

    try {
        const token = authorization.slice('Bearer '.length).trim();
        const decoded = await verifyFirebaseIdToken(token);
        return {
            uid: decoded.sub,
            email: String(decoded.email || '').toLowerCase(),
            name: String(decoded.name || decoded.email || '동아리원')
        };
    } catch (error) {
        if (error.status) throw error;
        throw createHttpError(401, '로그인 확인에 실패했습니다. 다시 로그인한 뒤 시도해 주세요.');
    }
}

async function readSmallJson(request) {
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
        total += chunk.length;
        if (total > MAX_JSON_BYTES) throw createHttpError(413, '요청 내용이 너무 큽니다.');
        chunks.push(chunk);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (error) {
        throw createHttpError(400, '요청 내용을 읽을 수 없습니다.');
    }
}

function parseContentRange(value) {
    const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(String(value || ''));
    if (!match) throw createHttpError(400, '영상 조각 정보(Content-Range)가 올바르지 않습니다.');
    const start = Number(match[1]);
    const end = Number(match[2]);
    const total = Number(match[3]);
    if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total < 1) {
        throw createHttpError(400, '영상 조각 크기가 올바르지 않습니다.');
    }
    return { start, end, total };
}

async function saveChunk(request, filePath, start, expectedLength) {
    const contentLength = Number(request.headers['content-length']);
    if (Number.isSafeInteger(contentLength) && contentLength !== expectedLength) {
        throw createHttpError(400, '영상 조각의 실제 크기가 맞지 않습니다.');
    }

    return new Promise((resolve, reject) => {
        let received = 0;
        let settled = false;
        const output = fs.createWriteStream(filePath, { flags: 'r+', start });

        const fail = (error) => {
            if (settled) return;
            settled = true;
            request.unpipe(output);
            output.destroy();
            reject(error);
        };

        request.on('data', (chunk) => {
            received += chunk.length;
            if (received > expectedLength) fail(createHttpError(413, '영상 조각이 설정된 크기보다 큽니다.'));
        });
        request.on('error', fail);
        output.on('error', fail);
        output.on('finish', () => {
            if (settled) return;
            settled = true;
            if (received !== expectedLength) {
                reject(createHttpError(400, '영상 조각이 전부 도착하지 않았습니다. 다시 시도해 주세요.'));
                return;
            }
            resolve();
        });

        request.pipe(output);
    });
}

async function countActiveUploads(uid) {
    const files = await fsp.readdir(paths.sessions);
    let count = 0;
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
            const session = await readJson(path.join(paths.sessions, file));
            if (session.ownerUid === uid) count += 1;
        } catch (_) {
            // 손상된 임시 기록은 정리 과정에서 지워집니다.
        }
    }
    return count;
}

async function cleanOldSessions() {
    const files = await fsp.readdir(paths.sessions);
    const now = Date.now();
    for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const id = file.slice(0, -5);
        if (!isSafeId(id)) continue;
        try {
            const session = await readJson(sessionPath(id));
            if (now - Number(session.updatedAt || session.createdAt || 0) > UPLOAD_SESSION_MAX_AGE_MS) {
                await Promise.allSettled([fsp.unlink(sessionPath(id)), fsp.unlink(partialPath(id))]);
            }
        } catch (_) {
            await Promise.allSettled([fsp.unlink(sessionPath(id)), fsp.unlink(partialPath(id))]);
        }
    }
}

async function handleStartUpload(request, response) {
    const user = await getAuthenticatedUser(request);
    if (await countActiveUploads(user.uid) >= config.maxActiveUploadsPerUser) {
        throw createHttpError(429, '진행 중인 영상 업로드가 있습니다. 잠시 후 다시 시도해 주세요.');
    }

    const input = await readSmallJson(request);
    const size = Number(input.size);
    const mimeType = String(input.mimeType || '').toLowerCase();
    const originalName = sanitizeFileName(input.filename);
    if (!Number.isSafeInteger(size) || size < 1 || size > config.maxVideoSizeBytes) {
        throw createHttpError(413, `동영상은 파일당 ${Math.round(config.maxVideoSizeBytes / 1024 / 1024)}MB까지 업로드할 수 있습니다.`);
    }
    if (!VIDEO_MIME_TYPES.has(mimeType) && !/\.(mp4|webm)$/i.test(originalName)) {
        throw createHttpError(415, 'MP4 또는 WebM 동영상만 올릴 수 있습니다.');
    }

    const id = crypto.randomUUID();
    const now = Date.now();
    const session = {
        id,
        ownerUid: user.uid,
        ownerEmail: user.email,
        originalName,
        mimeType: mimeType === 'video/webm' || /\.webm$/i.test(originalName) ? 'video/webm' : 'video/mp4',
        totalBytes: size,
        receivedBytes: 0,
        createdAt: now,
        updatedAt: now
    };
    await fsp.writeFile(partialPath(id), Buffer.alloc(0));
    await writeJsonAtomic(sessionPath(id), session);
    sendJson(response, 201, { uploadId: id, chunkSizeBytes: config.chunkSizeBytes });
}

async function loadOwnedSession(request, id) {
    if (!isSafeId(id)) throw createHttpError(404, '업로드 정보를 찾지 못했습니다.');
    const user = await getAuthenticatedUser(request);
    let session;
    try {
        session = await readJson(sessionPath(id));
    } catch (_) {
        throw createHttpError(404, '업로드가 만료되었거나 존재하지 않습니다.');
    }
    if (session.ownerUid !== user.uid) throw createHttpError(403, '내가 시작한 업로드만 이어서 보낼 수 있습니다.');
    return { session, user };
}

async function handleUploadChunk(request, response, id) {
    const { session } = await loadOwnedSession(request, id);
    const range = parseContentRange(request.headers['content-range']);
    const expectedLength = range.end - range.start + 1;
    if (range.total !== session.totalBytes || range.start !== session.receivedBytes || range.end >= session.totalBytes) {
        throw createHttpError(409, '영상 조각 순서가 맞지 않습니다. 업로드를 다시 시작해 주세요.');
    }
    if (expectedLength > config.chunkSizeBytes) {
        throw createHttpError(413, '영상 조각이 너무 큽니다.');
    }

    await saveChunk(request, partialPath(id), range.start, expectedLength);
    session.receivedBytes = range.end + 1;
    session.updatedAt = Date.now();
    await writeJsonAtomic(sessionPath(id), session);
    sendJson(response, 200, { receivedBytes: session.receivedBytes, totalBytes: session.totalBytes });
}

async function handleCompleteUpload(request, response, id) {
    const { session } = await loadOwnedSession(request, id);
    if (session.receivedBytes !== session.totalBytes) {
        throw createHttpError(409, '아직 도착하지 않은 영상 조각이 있습니다.');
    }

    const extension = fileExtension(session.originalName, session.mimeType);
    const finalFileName = `${id}${extension}`;
    const finalPath = path.join(paths.media, finalFileName);
    const metadata = {
        id,
        fileName: finalFileName,
        originalName: session.originalName,
        mimeType: session.mimeType,
        size: session.totalBytes,
        ownerUid: session.ownerUid,
        ownerEmail: session.ownerEmail,
        createdAt: Date.now()
    };

    await fsp.rename(partialPath(id), finalPath);
    await writeJsonAtomic(metadataPath(id), metadata);
    await fsp.unlink(sessionPath(id));
    sendJson(response, 201, {
        id,
        url: `${config.publicBaseUrl}/media/${id}`,
        originalName: metadata.originalName,
        size: metadata.size
    });
}

function parseByteRange(value, fileSize) {
    if (!value) return null;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value));
    if (!match) return undefined;
    const startText = match[1];
    const endText = match[2];
    let start;
    let end;
    if (!startText) {
        const suffixLength = Number(endText);
        if (!Number.isSafeInteger(suffixLength) || suffixLength < 1) return undefined;
        start = Math.max(0, fileSize - suffixLength);
        end = fileSize - 1;
    } else {
        start = Number(startText);
        end = endText ? Number(endText) : fileSize - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= fileSize) return undefined;
    return { start, end: Math.min(end, fileSize - 1) };
}

async function handleMedia(request, response, id) {
    if (!isSafeId(id)) return sendError(response, 404, '영상을 찾지 못했습니다.');
    let metadata;
    try {
        metadata = await readJson(metadataPath(id));
    } catch (_) {
        return sendError(response, 404, '영상을 찾지 못했습니다.');
    }

    const filePath = path.join(paths.media, metadata.fileName || '');
    if (!filePath.startsWith(paths.media + path.sep)) return sendError(response, 404, '영상을 찾지 못했습니다.');

    let stat;
    try {
        stat = await fsp.stat(filePath);
    } catch (_) {
        return sendError(response, 404, '영상 파일을 찾지 못했습니다.');
    }

    const range = parseByteRange(request.headers.range, stat.size);
    if (range === undefined) {
        response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return response.end();
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : stat.size - 1;
    const headers = {
        'Content-Type': metadata.mimeType || 'video/mp4',
        'Content-Length': end - start + 1,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff'
    };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') return response.end();
    fs.createReadStream(filePath, { start, end }).on('error', () => response.destroy()).pipe(response);
}

async function handleDeleteMedia(request, response, id) {
    const user = await getAuthenticatedUser(request);
    let metadata;
    try {
        metadata = await readJson(metadataPath(id));
    } catch (_) {
        throw createHttpError(404, '영상을 찾지 못했습니다.');
    }
    const isAdmin = user.email && config.adminEmails.includes(user.email);
    if (metadata.ownerUid !== user.uid && !isAdmin) throw createHttpError(403, '내 영상 또는 관리자만 삭제할 수 있습니다.');

    const filePath = path.join(paths.media, metadata.fileName || '');
    await Promise.allSettled([fsp.unlink(filePath), fsp.unlink(metadataPath(id))]);
    sendJson(response, 200, { deleted: true });
}

async function handleRequest(request, response) {
    applyCors(request, response);
    if (request.method === 'OPTIONS') {
        response.writeHead(204);
        return response.end();
    }

    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && pathname === '/health') {
        return sendJson(response, 200, { ok: true, storage: path.basename(paths.root), time: Date.now() });
    }
    if (request.method === 'POST' && pathname === '/api/uploads/start') return handleStartUpload(request, response);

    const chunkMatch = /^\/api\/uploads\/([0-9a-f-]+)\/chunks\/\d+$/i.exec(pathname);
    if (request.method === 'PUT' && chunkMatch) return handleUploadChunk(request, response, chunkMatch[1]);

    const completeMatch = /^\/api\/uploads\/([0-9a-f-]+)\/complete$/i.exec(pathname);
    if (request.method === 'POST' && completeMatch) return handleCompleteUpload(request, response, completeMatch[1]);

    const mediaMatch = /^\/media\/([0-9a-f-]+)$/i.exec(pathname);
    if ((request.method === 'GET' || request.method === 'HEAD') && mediaMatch) return handleMedia(request, response, mediaMatch[1]);
    if (request.method === 'DELETE' && mediaMatch) return handleDeleteMedia(request, response, mediaMatch[1]);

    return sendError(response, 404, '없는 주소입니다.');
}

async function start() {
    await Promise.all(Object.values(paths).map(folder => fsp.mkdir(folder, { recursive: true })));
    await cleanOldSessions();

    const server = http.createServer((request, response) => {
        handleRequest(request, response).catch(error => {
            if (!response.headersSent) sendError(response, error.status || 500, error.message || '서버에서 오류가 발생했습니다.');
            else response.destroy();
            if ((error.status || 500) >= 500) console.error('[서버 오류]', error);
        });
    });
    server.requestTimeout = 0;
    server.listen(config.port, '0.0.0.0', () => {
        console.log(`\n[준비 완료] 폰 서버가 ${config.port}번 문에서 실행 중입니다.`);
        console.log(`[저장 위치] ${paths.root}`);
        console.log(`[공개 주소] ${config.publicBaseUrl}`);
        console.log('종료하려면 Ctrl + C를 누르세요.\n');
    });
}

start().catch(error => stopWithMessage(error.message));
