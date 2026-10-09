const mangayomiSources = [{
    "id": 890070321,
    "name": "CineJoy",
    "lang": "en",
    "baseUrl": "https://cinejoy.pk",
    "apiUrl": "https://api.wing.st",
    "iconUrl": "https://cinejoy.pk/favicon.ico",
    "typeSource": "single",
    "itemType": 1,
    "isNsfw": false,
    "version": "0.1.0",
    "appMinVerReq": "0.9.9",
    "dateFormat": "",
    "dateFormatLocale": "",
    "pkgPath": "anime/src/en/cinejoy.js",
    "notes": "Requires Mangayomi 0.9.9 or newer for protected HLS playback."
}];

class DefaultExtension extends MProvider {
    get supportsLatest() {
        return true;
    }

    getHeaders() {
        return {
            "Referer": `${this.source.baseUrl}/`,
            "Origin": this.source.baseUrl
        };
    }

    async _tmdb(path, parameters = {}) {
        const query = Object.assign({
            api_key: "8476a7ab80ad76f0936744df0430e67c",
            language: "en-US",
            include_adult: "false"
        }, parameters);
        const queryString = Object.keys(query)
            .filter((key) => query[key] !== undefined && query[key] !== null)
            .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
            .join("&");
        const response = await new Client().get(
            `https://api.themoviedb.org/3${path}?${queryString}`,
            { "Accept": "application/json" }
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error(`TMDB request failed with HTTP ${response.statusCode}`);
        }
        return JSON.parse(response.body);
    }

    _catalogItem(item, fallbackType) {
        const type = item.media_type || fallbackType;
        if (type !== "movie" && type !== "tv") return null;
        const name = item.title || item.name || item.original_title || item.original_name;
        if (!name || !item.id) return null;
        const date = item.release_date || item.first_air_date || "";
        const year = date.substring(0, 4);
        return {
            name,
            imageUrl: item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : "",
            link: `/${type}/${item.id}?title=${encodeURIComponent(name)}&year=${encodeURIComponent(year)}`,
            _date: date
        };
    }

    _catalogPage(data, fallbackType) {
        const list = (data.results || [])
            .map((item) => this._catalogItem(item, fallbackType))
            .filter((item) => item !== null)
            .map(({ _date, ...item }) => item);
        return {
            list,
            hasNextPage: data.page < data.total_pages
        };
    }

    async getPopular(page) {
        const data = await this._tmdb("/trending/all/week", { page });
        return this._catalogPage(data);
    }

    async getLatestUpdates(page) {
        const today = new Date().toISOString().substring(0, 10);
        const [movies, shows] = await Promise.all([
            this._tmdb("/discover/movie", {
                page,
                sort_by: "primary_release_date.desc",
                "primary_release_date.lte": today,
                "vote_count.gte": "1"
            }),
            this._tmdb("/discover/tv", {
                page,
                sort_by: "first_air_date.desc",
                "first_air_date.lte": today,
                "vote_count.gte": "1"
            })
        ]);
        const list = [];
        for (const item of movies.results || []) {
            const mapped = this._catalogItem(item, "movie");
            if (mapped) list.push(mapped);
        }
        for (const item of shows.results || []) {
            const mapped = this._catalogItem(item, "tv");
            if (mapped) list.push(mapped);
        }
        list.sort((a, b) => b._date.localeCompare(a._date));
        return {
            list: list.map(({ _date, ...item }) => item),
            hasNextPage: page < movies.total_pages || page < shows.total_pages
        };
    }

    async search(query, page) {
        if (!query.trim()) return this.getPopular(page);
        const data = await this._tmdb("/search/multi", { query, page });
        return this._catalogPage(data);
    }

    async getDetail(url) {
        const match = url.match(/\/(movie|tv)\/(\d+)/);
        if (!match) throw new Error("Invalid CineJoy title URL");
        const type = match[1];
        const id = match[2];
        const detail = await this._tmdb(`/${type}/${id}`, {
            append_to_response: "credits"
        });
        const title = detail.title || detail.name || "CineJoy";
        const date = detail.release_date || detail.first_air_date || "";
        const year = date.substring(0, 4);
        const genre = (detail.genres || []).map((item) => item.name);
        const creators = type === "tv"
            ? (detail.created_by || []).map((person) => person.name)
            : ((detail.credits && detail.credits.crew) || [])
                .filter((person) => person.job === "Director")
                .map((person) => person.name);
        const descriptionParts = [detail.overview || ""];
        if (year) descriptionParts.push(`Year: ${year}`);
        if (detail.vote_average) {
            descriptionParts.push(`TMDB rating: ${Number(detail.vote_average).toFixed(1)}/10`);
        }

        const episodes = [];
        if (type === "movie") {
            episodes.push({
                num: 1,
                name: title,
                scanlator: "Movie",
                url: JSON.stringify({
                    kind: "movie",
                    tmdb: id,
                    title,
                    year
                })
            });
        } else {
            const seasons = (detail.seasons || [])
                .filter((season) => season.episode_count > 0)
                .sort((a, b) => a.season_number - b.season_number);
            for (const season of seasons) {
                for (let episode = 1; episode <= season.episode_count; episode++) {
                    episodes.push({
                        num: season.season_number * 1000 + episode,
                        name: `S${String(season.season_number).padStart(2, "0")}E${String(episode).padStart(2, "0")}`,
                        scanlator: season.name || `Season ${season.season_number}`,
                        url: JSON.stringify({
                            kind: "series",
                            tmdb: id,
                            season: String(season.season_number),
                            episode: String(episode),
                            title,
                            year
                        })
                    });
                }
            }
        }

        return {
            name: title,
            link: url,
            imageUrl: detail.poster_path
                ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
                : "",
            description: descriptionParts.filter(Boolean).join("\n\n"),
            author: creators.join(", "),
            status: this._status(detail.status),
            genre,
            episodes
        };
    }

    _status(status) {
        if (["Released", "Ended"].includes(status)) return 1;
        if (["Canceled", "Cancelled"].includes(status)) return 3;
        if (["Returning Series", "In Production", "Post Production", "Planned"].includes(status)) return 0;
        return 5;
    }

    async getVideoList(url) {
        const request = JSON.parse(url);
        const script = `(${cineJoyResolve.toString()})(${JSON.stringify(request)});`;
        const raw = await evaluateJavascriptViaWebview(
            this.source.baseUrl,
            {},
            [script],
            70
        );
        if (!raw) {
            throw new Error("CineJoy resolver timed out without returning a stream");
        }
        const result = JSON.parse(raw);
        if (result.error) throw new Error(result.error);
        if (!result.url || !result.url.startsWith("https://")) {
            throw new Error("CineJoy returned no playable HTTPS stream");
        }

        const headers = this.getHeaders();
        const proxiedUrl = await createHlsProxyUrl(result.url, headers);
        return [{
            url: proxiedUrl,
            originalUrl: proxiedUrl,
            quality: `CineJoy ${result.server || "Auto"} HLS`,
            headers: {},
            subtitles: result.captions || []
        }];
    }

    getFilterList() {
        return [];
    }
}

async function cineJoyResolve(request) {
    const api = "https://api.wing.st";
    const expectedWasmHash = "40c923580779e2a850fc5ab3f0046be565ed717883cf4547ed3a87de2450bdcf";
    const verifiedServers = ["Lisbon", "Nebula", "Solara"];
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    function send(value) {
        window.flutter_inappwebview.callHandler("setResponse", JSON.stringify(value));
    }

    function hex(bytes) {
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function captions(stream) {
        return (stream.captions || []).map((caption) => {
            if (typeof caption === "string") return { file: caption, label: "Subtitle" };
            return {
                file: caption.url || caption.file || caption.src || "",
                label: caption.label || caption.language || caption.lang || "Subtitle"
            };
        }).filter((caption) => caption.file);
    }

    function candidates(envelope) {
        const streams = envelope && envelope.data && Array.isArray(envelope.data.stream)
            ? envelope.data.stream
            : [];
        const output = [];
        for (const stream of streams) {
            if (typeof stream.playlist === "string" && stream.playlist.startsWith("https://")) {
                output.push({ url: stream.playlist, captions: captions(stream) });
                continue;
            }
            if (stream.type === "file" && stream.qualities) {
                const qualities = Object.keys(stream.qualities)
                    .sort((a, b) => Number(b) - Number(a));
                for (const quality of qualities) {
                    const value = stream.qualities[quality];
                    const streamUrl = typeof value === "string" ? value : value && value.url;
                    if (typeof streamUrl === "string" && streamUrl.startsWith("https://")) {
                        output.push({ url: streamUrl, captions: captions(stream) });
                    }
                }
            }
        }
        return output;
    }

    function firstSuccessful(promises) {
        return new Promise((resolve, reject) => {
            let failures = 0;
            const messages = [];
            for (const promise of promises) {
                Promise.resolve(promise).then(resolve).catch((error) => {
                    failures++;
                    messages.push(error && error.message ? error.message : String(error));
                    if (failures === promises.length) reject(new Error(messages.join("; ")));
                });
            }
        });
    }

    try {
        const wasmResponse = await fetch(`${api}/crush.wasm`, { cache: "no-store" });
        if (!wasmResponse.ok) throw new Error(`CineJoy encoder HTTP ${wasmResponse.status}`);
        const wasmBytes = new Uint8Array(await wasmResponse.arrayBuffer());
        const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", wasmBytes));
        if (hex(digest) !== expectedWasmHash) {
            throw new Error("CineJoy encoder changed; refusing to run unverified code");
        }
        const instantiated = await WebAssembly.instantiate(wasmBytes, {});
        const wasm = instantiated.instance.exports;

        function seal(path, payload) {
            const input = encoder.encode(JSON.stringify({ path, payload }));
            const seed = crypto.getRandomValues(new Uint8Array(44));
            const capacity = input.length + 512;
            const inputPtr = wasm.alloc(input.length);
            const seedPtr = wasm.alloc(seed.length);
            const outputPtr = wasm.alloc(capacity);
            new Uint8Array(wasm.memory.buffer).set(input, inputPtr);
            new Uint8Array(wasm.memory.buffer).set(seed, seedPtr);
            const outputLength = wasm.seal_request(
                inputPtr,
                input.length,
                seedPtr,
                seed.length,
                outputPtr,
                capacity
            );
            if (outputLength <= 98 || outputLength > capacity) {
                throw new Error("CineJoy encoder returned an invalid request");
            }
            const output = new Uint8Array(
                wasm.memory.buffer,
                outputPtr,
                outputLength
            ).slice();
            return {
                responseKey: output.slice(0, 32),
                keyId: output[32],
                ephemeralPublic: output.slice(33, 98),
                body: output.slice(98)
            };
        }

        async function open(sealed) {
            const response = await fetch(`${api}/g`, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
                body: sealed.body
            });
            if (!response.ok) throw new Error(`CineJoy resolver HTTP ${response.status}`);
            const wire = new Uint8Array(await response.arrayBuffer());
            if (wire.length < 29) throw new Error("CineJoy resolver returned a short response");
            const prefix = encoder.encode("lumen-gate-v2");
            const aad = new Uint8Array(prefix.length + 3 + sealed.ephemeralPublic.length);
            aad.set(prefix);
            aad.set([0, 2, sealed.keyId], prefix.length);
            aad.set(sealed.ephemeralPublic, prefix.length + 3);
            const key = await crypto.subtle.importKey(
                "raw",
                sealed.responseKey,
                "AES-GCM",
                false,
                ["decrypt"]
            );
            const plaintext = await crypto.subtle.decrypt({
                name: "AES-GCM",
                iv: wire.slice(0, 12),
                additionalData: aad,
                tagLength: 128
            }, key, wire.slice(12));
            const envelope = JSON.parse(decoder.decode(plaintext));
            if (envelope.status < 200 || envelope.status >= 300) {
                throw new Error(`CineJoy provider status ${envelope.status}`);
            }
            return envelope;
        }

        let servers = verifiedServers;
        try {
            const catalogResponse = await fetch(`${api}/servers`, { cache: "no-store" });
            const catalog = await catalogResponse.json();
            const ready = (catalog.servers || [])
                .filter((server) => verifiedServers.includes(server.name) && String(server.status).toLowerCase() === "ok")
                .map((server) => server.name);
            if (ready.length) servers = ready;
        } catch (_) {
            // The verified fallback list remains usable if the catalog is unavailable.
        }

        const payload = { tmdb: String(request.tmdb) };
        if (request.kind === "series") {
            payload.season = String(request.season);
            payload.episode = String(request.episode);
        }
        if (request.title) payload.title = request.title;
        if (request.year) payload.year = request.year;

        async function tryServer(server) {
            const path = `/${server}/${request.kind}`;
            let envelope = await open(seal(path, payload));
            let found = candidates(envelope);
            if (!found.length) {
                const streams = envelope && envelope.data && Array.isArray(envelope.data.stream)
                    ? envelope.data.stream.slice(0, 2)
                    : [];
                for (const stream of streams) {
                    if (stream.id === undefined || stream.id === null) continue;
                    envelope = await open(seal(path, Object.assign({}, payload, {
                        embed: stream.id
                    })));
                    found = candidates(envelope);
                    if (found.length) break;
                }
            }
            if (!found.length) throw new Error(`${server}: no streams`);
            return Object.assign({ server }, found[0]);
        }

        send(await firstSuccessful(servers.map((server) => tryServer(server))));
    } catch (error) {
        send({ error: error && error.message ? error.message : String(error) });
    }
}
