require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();

// Fungsi async untuk inisialisasi discord-player
async function initializePlayer() {
  console.log('Memulai inisialisasi discord-player...');

  const player = new Player(client, {
    ytdlOptions: {
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    },
  });

  // Load semua default extractor (Attachment, SoundCloud, Vimeo, Spotify, Apple Music, dll)
  // NOTE: YouTube resmi dihapus di v7 karena sering rusak, jadi kalau play YouTube gagal → kita tambah extractor alternatif nanti
  await player.extractors.loadMulti(DefaultExtractors);
  const { YoutubeiExtractor } = require('discord-player-youtubei');
player.extractors.register(YoutubeiExtractor, {});
console.log('YoutubeiExtractor berhasil ditambahkan!');

  console.log('Default extractors berhasil dimuat!');
  // Logging aman: Cek jumlah extractor yang terload (tanpa getAll())
  console.log(`Jumlah extractor terdaftar: ${player.extractors.size || 'tidak diketahui (API berubah)'}`);

  // Event player
  player.events.on('playerStart', (queue, track) => {
    queue.metadata?.channel?.send(`Sedang memutar: **${track.title}** oleh ${track.author} 🎶`)?.catch(() => {});
  });

  player.events.on('empty', (queue) => {
    queue.metadata?.channel?.send('Antrian habis, keluar dari voice channel 👋')?.catch(() => {});
  });

  player.events.on('error', (queue, error) => {
    console.error(`Player error di ${queue?.guild?.name || 'unknown'}:`, error);
    queue.metadata?.channel?.send(`Ada error: ${error.message}`)?.catch(() => {});
  });

  player.events.on('playerError', (queue, error) => {
    console.error('PlayerError:', error);
    queue.metadata?.channel?.send('Gagal memutar track ini 😢')?.catch(() => {});
  });

  client.player = player;

  console.log('discord-player berhasil diinisialisasi!');
}

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(`[WARNING] Command di ${filePath} kurang "data" atau "execute"`);
    }
  }
}

client.once('ready', async () => {
  console.log(`Bot online sebagai ${client.user.tag} 🚀`);
  console.log(`Prefix saat ini: ${process.env.PREFIX || '!'}`);
  
  client.user.setActivity(`${process.env.PREFIX || '!'}help | Musik & Lainnya`, { type: 'PLAYING' });

  // Init player di sini
  await initializePlayer();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);

  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(`Error command ${commandName}:`, error);
    await message.reply('Ada error saat jalankan command!').catch(() => {});
  }
});

client.login(process.env.TOKEN);