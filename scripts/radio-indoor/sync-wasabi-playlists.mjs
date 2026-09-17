import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.POSTGRES_DATABASE_URL });
const s3 = new S3Client({
  endpoint: process.env.WASABI_ENDPOINT?.startsWith("http") ? process.env.WASABI_ENDPOINT : "https://" + process.env.WASABI_ENDPOINT,
  region: process.env.WASABI_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.WASABI_ACCESS_KEY,
    secretAccessKey: process.env.WASABI_SECRET_KEY
  }
});
const bucket = process.env.WASABI_BUCKET;

async function sync() {
  const stationRes = await pool.query("SELECT id, user_id FROM radio_stations LIMIT 1");
  const stationId = stationRes.rows[0].id;
  const userId = stationRes.rows[0].user_id;
  console.log("Using station:", stationId, "user:", userId);

  let continuationToken = undefined;
  let manifestKeys = [];
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "radio-indoor/catalog/metadata/playlists/",
      ContinuationToken: continuationToken
    }));
    for (const item of res.Contents || []) {
      manifestKeys.push(item.Key);
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  console.log("Found", manifestKeys.length, "playlist manifests in Wasabi.");
  const tracksDb = await pool.query("SELECT id, source_id, title FROM radio_catalog_tracks");
  const trackMap = new Map();
  for (const t of tracksDb.rows) {
    trackMap.set(t.source_id, t.id);
  }
  console.log("Loaded", trackMap.size, "tracks from DB");

  const concurrency = 20;
  let processed = 0;
  let insertedPlaylists = 0;
  let linkedTracks = 0;
  let updatedTrackThumbs = 0;

  for (let i = 0; i < manifestKeys.length; i += concurrency) {
    const chunk = manifestKeys.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (key) => {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const str = await obj.Body.transformToString();
        const data = JSON.parse(str);
        const p = data.playlist || {};
        const title = String(p.title || p.album || "Playlist").trim().slice(0, 160);
        const artist = p.artist ? String(p.artist).trim().slice(0, 180) : null;
        const genre = p.genre ? String(p.genre).trim().slice(0, 80) : null;
        const coverKey = p.cover?.storageKey || null;
        const description = (artist ? artist + (genre ? " · " + genre : "") : p.album) ? String(artist ? artist + (genre ? " · " + genre : "") : p.album).slice(0, 500) : null;

        const existing = await pool.query("SELECT id FROM public.radio_playlists WHERE user_id = $1 AND name = $2 LIMIT 1", [userId, title]);
        let playlistId = existing.rows[0]?.id;
        if (!playlistId) {
          const ins = await pool.query("INSERT INTO public.radio_playlists (user_id, station_id, name, description, kind, cover_key, settings) VALUES ($1, $2, $3, $4, \x27custom\x27, $5, $6::jsonb) RETURNING id", [userId, stationId, title, description, coverKey, JSON.stringify({ source: "wasabi-manifest", manifestKey: key, artist, genre })]);
          playlistId = ins.rows[0]?.id;
        } else {
          await pool.query("UPDATE public.radio_playlists SET cover_key = coalesce($1, cover_key), description = coalesce($2, description), settings = $3::jsonb WHERE id = $4", [coverKey, description, JSON.stringify({ source: "wasabi-manifest", manifestKey: key, artist, genre }), playlistId]);
        }

        if (playlistId && Array.isArray(data.tracks)) {
          insertedPlaylists++;
          for (let pos = 0; pos < data.tracks.length; pos++) {
            const tr = data.tracks[pos];
            const dbId = trackMap.get(tr.trackId) || trackMap.get("yt-" + (tr.source?.videoId || ""));
            if (dbId) {
              await pool.query("INSERT INTO public.radio_playlist_items (playlist_id, track_id, position) VALUES ($1, $2, $3) ON CONFLICT (playlist_id, track_id) DO UPDATE SET position = excluded.position", [playlistId, dbId, pos]);
              linkedTracks++;
              if (coverKey) {
                await pool.query("UPDATE public.radio_catalog_tracks SET thumbnail_key = $1, album = coalesce(album, $2) WHERE id = $3", [coverKey, p.album || title, dbId]);
                updatedTrackThumbs++;
              }
            }
          }
        }
      } catch (err) {
        console.error("Error processing " + key, err.message);
      }
    }));
    processed += chunk.length;
    if (processed % 100 === 0 || processed === manifestKeys.length) {
      console.log("Progress:", processed, "/", manifestKeys.length, "playlists processed");
    }
  }

  console.log("Sync finished! Synced playlists:", insertedPlaylists, "Linked items:", linkedTracks, "Updated track thumbs:", updatedTrackThumbs);
  await pool.end();
}

sync().catch(console.error);