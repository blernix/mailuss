# Bot Pilule 💊

Bot Telegram pour rappeler la prise de la pilule contraceptive avec suivi et statistiques.

## Fonctionnalités

- 🔔 Rappels quotidiens à l'heure configurée
- ✅ Confirmation de prise avec boutons interactifs
- 📊 Statistiques et taux de réussite
- 📝 Historique des 7 derniers jours
- 🔥 Suivi de série (streak)
- 💬 Messages encourageants aléatoires

## Installation

```bash
npm install
```

## Configuration

Crée un fichier `.env` avec ton token Telegram :

```bash
TELEGRAM_BOT_TOKEN=ton_token_ici
```

## Lancement

```bash
npm start
```

## Commandes disponibles

- `/start` - Démarrer le bot
- `/settime HH:MM` - Configurer l'heure du rappel (ex: `/settime 20:30`)
- `/stats` - Voir les statistiques
- `/history` - Voir l'historique des 7 derniers jours
- `/cancel` - Annuler le rappel quotidien
- `/help` - Afficher l'aide

## Déploiement sur VPS

### Avec PM2 (recommandé)

```bash
npm install -g pm2
pm2 start index.js --name bot-pilule
pm2 save
pm2 startup
```

### Avec systemd

Crée un fichier `/etc/systemd/system/bot-pilule.service` :

```ini
[Unit]
Description=Bot Pilule Telegram
After=network.target

[Service]
Type=simple
User=ton_user
WorkingDirectory=/chemin/vers/bot_mailuss
ExecStart=/usr/bin/node index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Puis :

```bash
sudo systemctl enable bot-pilule
sudo systemctl start bot-pilule
```
