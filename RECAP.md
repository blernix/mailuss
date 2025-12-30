# Récapitulatif du projet Bot Pilule 💊

## Contexte
Bot Telegram pour rappeler à ta copine de prendre sa pilule contraceptive à heure fixe, avec suivi et confirmation.

## Bot Telegram
- **Nom** : Pillule_bot
- **Lien** : t.me/Pillule_bot
- **Token** : Configuré dans `.env`

## Ce qui a été fait ✅

### Structure du projet
```
bot_mailuss/
├── index.js          # Code principal du bot
├── package.json      # Dépendances Node.js
├── .env             # Token Telegram (configuré)
├── .env.example     # Template pour l'env
├── .gitignore       # Fichiers à ignorer
└── README.md        # Documentation
```

### Fonctionnalités implémentées

**Commandes disponibles :**
- `/start` - Démarrer le bot et voir le message d'accueil
- `/settime HH:MM` - Configurer l'heure du rappel (ex: `/settime 21:00`)
- `/stats` - Voir les statistiques (taux de réussite, série, etc.)
- `/history` - Voir l'historique des 7 derniers jours
- `/cancel` - Annuler le rappel quotidien
- `/help` - Afficher l'aide

**Fonctionnalités automatiques :**
- 🔔 Rappel quotidien à l'heure configurée
- 3 boutons de réponse :
  - ✅ "Oui, j'ai pris ma pilule"
  - ❌ "Non, j'ai oublié"
  - ⏰ "Je la prends maintenant"
- 💬 Messages encourageants aléatoires
- 📊 Calcul automatique du taux de réussite
- 🔥 Suivi de série (streak) de jours consécutifs
- 💾 Sauvegarde automatique dans `data.json`

## Pour démarrer le projet

### Installation
```bash
cd /Users/killianlecrut/Documents/perso/kikiweb/bot_mailuss
npm install
```

### Test en local
```bash
npm start
```

### Test du bot
1. Ouvre Telegram
2. Cherche `@Pillule_bot`
3. Envoie `/start`
4. Configure l'heure avec `/settime 21:00` (par exemple)

## Pour déployer sur ton VPS

### Étape 1 : Transférer les fichiers
```bash
scp -r /Users/killianlecrut/Documents/perso/kikiweb/bot_mailuss user@ton-vps:/home/user/
```

### Étape 2 : Sur le VPS
```bash
cd /home/user/bot_mailuss
npm install
```

### Étape 3 : Installer PM2 (recommandé)
```bash
npm install -g pm2
pm2 start index.js --name bot-pilule
pm2 save
pm2 startup
```

### Commandes PM2 utiles
```bash
pm2 status              # Voir l'état du bot
pm2 logs bot-pilule     # Voir les logs
pm2 restart bot-pilule  # Redémarrer
pm2 stop bot-pilule     # Arrêter
```

## Idées d'améliorations possibles

- 🎨 Ajouter plus de messages sympas/drôles
- 👥 Mode couple (2 utilisateurs qui partagent les stats)
- 📅 Rappels pour le renouvellement de la plaquette
- 🎉 Badges ou récompenses pour les bonnes séries
- 📸 Support d'une photo de la plaquette pour tracker visuellement
- ⏰ Snooze pour rappeler 10min plus tard
- 📱 Notification si oubli détecté

## Données sauvegardées

Le fichier `data.json` contient :
```json
{
  "userId": {
    "chatId": 123456,
    "reminderTime": "21:00",
    "history": [
      {
        "date": "2025-12-22",
        "status": "taken",
        "timestamp": "2025-12-22T21:05:00.000Z"
      }
    ]
  }
}
```

## Dépendances utilisées

- **grammy** - Framework moderne pour bot Telegram
- **node-cron** - Gestion des tâches planifiées (rappels)
- **dotenv** - Gestion des variables d'environnement

## Notes importantes

- Le token est dans `.env` (ne pas commiter sur GitHub)
- Les données utilisateur sont dans `data.json` (gitignore)
- Le bot vérifie chaque minute si c'est l'heure d'envoyer un rappel
- Fuseau horaire : système local (à vérifier sur le VPS)

## Contact

Bot créé le : 22 décembre 2025
Prêt à être déployé et testé !
