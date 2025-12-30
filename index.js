import { Bot, InlineKeyboard } from 'grammy';
import cron from 'node-cron';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const DATA_FILE = './data.json';

// System prompt pour l'IA
const SYSTEM_PROMPT = `Tu es un bot assistant personnel pour Mailuss, la copine de l'utilisateur depuis 2 ans.
Ton rôle est de l'aider à se rappeler de prendre sa pilule contraceptive avec humour et bienveillance.

PERSONNALITÉ :
- Humour satirique et noir, mais toujours bienveillant
- Tu adores les références historiques décalées et les anecdotes que personne ne connaît
- Tu peux faire des blagues un peu limites (homophobes, racistes, misogynes) mais UNIQUEMENT dans un cadre privé entre eux, avec second degré et complicité
- Tu connais leur relation intime et complice
- Ton ton est décontracté, comme un ami proche qui les connaît bien

RÈGLES :
- Réponds en 1-2 phrases maximum, sois concis
- Si elle dit qu'elle a pris sa pilule : félicite-la avec une blague ou référence historique
- Si elle a oublié : rassure-la sans dramatiser, avec une touche d'humour
- Détecte les intentions : "pris", "oublié", "stats", "aide", "salut", etc.
- Utilise des emojis mais avec parcimonie
- N'hésite pas à glisser une info historique absurde ou décalée

IMPORTANT : Ton but est de faire sourire Mailuss tout en étant utile. L'humour est un moyen de détendre l'atmosphère, pas de blesser.

DÉTECTION D'INTENTIONS :
Si le message parle de :
- Prendre la pilule / "j'ai pris" / "c'est fait" → Retourne JSON: {"action": "taken", "response": "ton message drôle"}
- Oublier / "j'ai oublié" / "merde" / "raté" → Retourne JSON: {"action": "forgot", "response": "ton message rassurant avec humour"}
- Stats / statistiques → Retourne JSON: {"action": "stats"}
- Badges / récompenses / achievements → Retourne JSON: {"action": "badges"}
- Aide / help → Retourne JSON: {"action": "help"}
- Changer l'heure du rappel / "change le rappel à 21h" / "rappelle-moi à 20h30" → Retourne JSON: {"action": "set_time", "time": "HH:MM", "response": "ton message de confirmation"}
- Annuler le rappel / "annule le rappel" / "stop les notifications" → Retourne JSON: {"action": "cancel", "response": "ton message"}
- Historique / "mon historique" / "les derniers jours" → Retourne JSON: {"action": "history"}
- Salutations → Retourne JSON: {"action": "greeting", "response": "ton message"}
- Autre conversation → Retourne JSON: {"action": "chat", "response": "ton message"}

IMPORTANT : Pour set_time, extrais l'heure du message et retourne-la au format HH:MM (24h).
Exemples : "21h" → "21:00", "20h30" → "20:30", "9h15" → "09:15"

RETOURNE TOUJOURS UN JSON VALIDE.`;

// Fonction pour appeler l'IA
async function askAI(userMessage, context = {}) {
  try {
    // Utiliser l'API REST directement
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const contextStr = context.stats ? `
Stats de Mailuss : ${context.stats.total} jours, ${context.stats.successRate}% de réussite, série de ${context.stats.streak} jours.
` : '';

    const fullPrompt = `${SYSTEM_PROMPT}

${contextStr}
Message de Mailuss : "${userMessage}"

Réponds en JSON valide uniquement, sans backticks ni markdown.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur API Gemini:', data);
      throw new Error(data.error?.message || 'Erreur API');
    }

    const text = data.candidates[0].content.parts[0].text;

    // Nettoyer la réponse (parfois l'IA ajoute des backticks)
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    return JSON.parse(cleanText);
  } catch (error) {
    console.error('Erreur IA:', error);
    return {
      action: 'chat',
      response: 'Désolé, j\'ai bugué comme Windows Vista en 2007... Réessaye ! 😅'
    };
  }
}

// Messages sympas
const ENCOURAGEMENTS = [
  "💪 Bien joué ! Vous assurez !",
  "🌟 Top ! La régularité c'est la clé !",
  "✨ Parfait ! Continue comme ça !",
  "🎯 Nickel ! Tu gères !",
  "💖 Super ! Vous êtes au top tous les deux !",
  "🔥 Excellent ! Keep it up !",
  "⭐ Bravo ! C'est important de prendre soin de soi !",
];

const FORGOT_MESSAGES = [
  "😅 Pas de souci ! L'important c'est de le noter.",
  "💙 On oublie tous parfois, merci d'avoir été honnête !",
  "📝 Noté ! Essaie de prendre un peu de temps pour toi.",
  "🤗 C'est ok ! Demain est un autre jour !",
];

// Fun Facts historiques sur la contraception
const FUN_FACTS = [
  "💡 Fun fact : Les Égyptiens utilisaient du miel et des excréments de crocodile comme contraceptif. Heureusement, on a évolué ! 🐊",
  "💡 Fun fact : Au Moyen-Âge, on pensait que boire de l'eau où un forgeron avait trempé son fer chaud empêchait les grossesses. Spoiler : non. 🔥",
  "💡 Fun fact : Cléopâtre utilisait du silphium, une plante si populaire qu'elle a disparu par surexploitation. La première victime du succès ! 🌿",
  "💡 Fun fact : Les Romains utilisaient des vessies d'animaux comme préservatifs. Glamour, non ? 🏛️",
  "💡 Fun fact : Casanova utilisait des moitiés de citron comme diaphragme. L'acidité devait aider... ou pas. 🍋",
  "💡 Fun fact : La pilule contraceptive a été autorisée en France en 1967. Avant ça, c'était la loterie ! 🎲",
  "💡 Fun fact : Au 18e siècle, les femmes sautaient 7 fois après l'acte pour éviter une grossesse. Hippocrate était sérieux. 🤸",
  "💡 Fun fact : Les Vikings utilisaient des algues marines. Efficacité douteuse, mais au moins c'était bio ! 🌊",
  "💡 Fun fact : Au 19e siècle, le mercure était utilisé comme contraceptif. Spoiler : très mauvaise idée. ☠️",
  "💡 Fun fact : Marie Stopes a ouvert la 1ère clinique de contraception en 1921 à Londres. Une révolution ! 👑",
];

// Système de badges
const BADGES = {
  first_time: { name: "Première Prise", emoji: "🌱", desc: "Bienvenue dans l'aventure !" },
  streak_3: { name: "Débutante", emoji: "🥉", desc: "3 jours d'affilée !" },
  streak_7: { name: "Régulière", emoji: "🥈", desc: "Une semaine parfaite !" },
  streak_14: { name: "Warrior", emoji: "🥇", desc: "2 semaines consécutives !" },
  streak_30: { name: "Légende", emoji: "👑", desc: "Un mois sans faute !" },
  perfect_week: { name: "Semaine Parfaite", emoji: "⭐", desc: "7/7 cette semaine !" },
  perfect_month: { name: "Mois Parfait", emoji: "💎", desc: "100% sur un mois !" },
  comeback: { name: "Résiliente", emoji: "💪", desc: "Revenue après un oubli !" },
};

// Gestion des données
async function loadData() {
  if (existsSync(DATA_FILE)) {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return {};
}

async function saveData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

async function getUserData(userId) {
  const data = await loadData();
  if (!data[userId]) {
    data[userId] = {
      chatId: null,
      reminderTime: null,
      history: [],
      badges: [],
      lastFunFact: null,
      snoozeReminder: null,
      snoozeCount: 0
    };
    await saveData(data);
  }
  // Migration pour les anciens utilisateurs
  if (!data[userId].badges) data[userId].badges = [];
  if (!data[userId].lastFunFact) data[userId].lastFunFact = null;
  if (!data[userId].snoozeReminder) data[userId].snoozeReminder = null;
  if (data[userId].snoozeCount === undefined) data[userId].snoozeCount = 0;

  return data[userId];
}

async function updateUserData(userId, userData) {
  const data = await loadData();
  data[userId] = userData;
  await saveData(data);
}

// Calculer le streak actuel
function calculateStreak(history) {
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].status === 'taken') {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// Vérifier et débloquer les badges
function checkBadges(userData) {
  const newBadges = [];
  const history = userData.history;
  const currentBadges = userData.badges || [];

  // Badge: Première prise
  if (history.length === 1 && !currentBadges.includes('first_time')) {
    newBadges.push('first_time');
  }

  // Calculer le streak
  const streak = calculateStreak(history);

  // Badges de streak
  if (streak >= 3 && !currentBadges.includes('streak_3')) newBadges.push('streak_3');
  if (streak >= 7 && !currentBadges.includes('streak_7')) newBadges.push('streak_7');
  if (streak >= 14 && !currentBadges.includes('streak_14')) newBadges.push('streak_14');
  if (streak >= 30 && !currentBadges.includes('streak_30')) newBadges.push('streak_30');

  // Badge comeback (revenue après un oubli)
  if (history.length >= 2) {
    const lastTwo = history.slice(-2);
    if (lastTwo[0].status === 'forgot' && lastTwo[1].status === 'taken' && !currentBadges.includes('comeback')) {
      newBadges.push('comeback');
    }
  }

  // Badge semaine parfaite (7 derniers jours)
  if (history.length >= 7) {
    const lastWeek = history.slice(-7);
    if (lastWeek.every(h => h.status === 'taken') && !currentBadges.includes('perfect_week')) {
      newBadges.push('perfect_week');
    }
  }

  // Badge mois parfait (30 derniers jours)
  if (history.length >= 30) {
    const lastMonth = history.slice(-30);
    if (lastMonth.every(h => h.status === 'taken') && !currentBadges.includes('perfect_month')) {
      newBadges.push('perfect_month');
    }
  }

  return newBadges;
}

// Générer un graphique ASCII des 7 derniers jours
function generateGraph(history) {
  const last7 = history.slice(-7);
  if (last7.length === 0) return "";

  let graph = "📊 Tes 7 derniers jours :\n\n";

  for (const entry of last7) {
    const date = new Date(entry.date);
    const dayName = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][date.getDay()];
    const dateStr = `${dayName} ${date.getDate()}/${date.getMonth() + 1}`;
    const bar = entry.status === 'taken' ? '🟩🟩🟩🟩🟩' : '🟥';

    graph += `${dateStr.padEnd(10)} ${bar}\n`;
  }

  return graph;
}

// Obtenir un fun fact du jour généré par l'IA
async function getDailyFunFact(userData) {
  const today = new Date().toISOString().split('T')[0];

  // Si on a déjà montré un fun fact aujourd'hui, ne rien retourner
  if (userData.lastFunFact === today) return null;

  try {
    // Demander à l'IA de générer un fun fact unique
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const prompt = `Génère une anecdote historique courte (1-2 phrases max) sur la contraception à travers l'Histoire.

Critères :
- Doit être drôle, décalée, surprenante
- Humour noir bienveillant
- Fait réel et historique (pas d'invention)
- Commence par "💡 Fun fact :"
- Une seule anecdote unique et différente des précédentes

Exemples de style :
- "💡 Fun fact : Au Moyen-Âge, on pensait que boire de l'eau où un forgeron avait trempé son fer chaud empêchait les grossesses. Spoiler : non. 🔥"
- "💡 Fun fact : Casanova utilisait des moitiés de citron comme diaphragme. L'acidité devait aider... ou pas. 🍋"

Génère maintenant une nouvelle anecdote dans ce style :`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erreur API Gemini pour fun fact:', data);
      // Fallback sur un fun fact pré-rempli
      return FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
    }

    const funFact = data.candidates[0].content.parts[0].text.trim();
    userData.lastFunFact = today;

    return funFact;
  } catch (error) {
    console.error('Erreur lors de la génération du fun fact:', error);
    // Fallback sur un fun fact pré-rempli
    const fact = FUN_FACTS[Math.floor(Math.random() * FUN_FACTS.length)];
    userData.lastFunFact = today;
    return fact;
  }
}

// Commandes
bot.command('start', async (ctx) => {
  const firstName = ctx.from.first_name;
  await ctx.reply(
    `👋 Salut ${firstName} !\n\n` +
    `Je suis là pour t'aider à ne pas oublier ta pilule contraceptive 💊\n\n` +
    `🔔 Utilise /settime pour configurer l'heure de ton rappel quotidien\n` +
    `📊 Utilise /stats pour voir tes statistiques\n` +
    `❓ Utilise /help pour plus d'infos\n\n` +
    `Prendre soin de soi, c'est important ! 💙`
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 *Commandes disponibles :*\n\n` +
    `/start - Démarrer le bot\n` +
    `/settime HH:MM - Configurer l'heure du rappel (ex: /settime 20:30)\n` +
    `/stats - Voir tes statistiques\n` +
    `/history - Voir l'historique des 7 derniers jours\n` +
    `/cancel - Annuler le rappel quotidien\n` +
    `/help - Afficher cette aide\n\n` +
    `💡 *Comment ça marche ?*\n` +
    `Configure ton heure de rappel avec /settime, et je t'enverrai un message ` +
    `chaque jour à cette heure. Tu pourras alors confirmer si tu as pris ta pilule ou non.\n\n` +
    `Les données sont sauvegardées pour que tu puisses suivre ta régularité ! 📈`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('settime', async (ctx) => {
  const timeArg = ctx.match;

  if (!timeArg || !timeArg.trim()) {
    await ctx.reply(
      `⏰ Utilise cette commande avec l'heure souhaitée.\n` +
      `Exemple : /settime 20:30`
    );
    return;
  }

  const timeMatch = timeArg.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    await ctx.reply(
      `❌ Format d'heure invalide. Utilise le format HH:MM (ex: 20:30)`
    );
    return;
  }

  const hour = parseInt(timeMatch[1]);
  const minute = parseInt(timeMatch[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    await ctx.reply(
      `❌ Heure invalide. L'heure doit être entre 00:00 et 23:59`
    );
    return;
  }

  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const userData = await getUserData(userId);

  userData.chatId = chatId;
  userData.reminderTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  await updateUserData(userId, userData);

  await ctx.reply(
    `✅ Parfait ! Je t'enverrai un rappel tous les jours à ${userData.reminderTime} 🔔\n\n` +
    `Tu pourras confirmer si tu as pris ta pilule directement dans le chat !`
  );
});

bot.command('stats', async (ctx) => {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  if (!userData.history || userData.history.length === 0) {
    await ctx.reply(
      `📊 Pas encore de données ! Configure ton rappel avec /settime pour commencer.`
    );
    return;
  }

  const total = userData.history.length;
  const taken = userData.history.filter(h => h.status === 'taken').length;
  const forgot = userData.history.filter(h => h.status === 'forgot').length;
  const successRate = (taken / total * 100) || 0;

  // Streak (série de prises consécutives)
  let streak = 0;
  for (let i = userData.history.length - 1; i >= 0; i--) {
    if (userData.history[i].status === 'taken') {
      streak++;
    } else {
      break;
    }
  }

  let message =
    `📊 *Tes statistiques* 📈\n\n` +
    `📅 Total de jours suivis : ${total}\n` +
    `✅ Pilule prise : ${taken} fois\n` +
    `❌ Oublis : ${forgot} fois\n` +
    `📊 Taux de réussite : ${successRate.toFixed(1)}%\n` +
    `🔥 Série en cours : ${streak} jour${streak > 1 ? 's' : ''}\n\n`;

  if (successRate >= 95) {
    message += "🌟 Incroyable ! Tu es super régulière !";
  } else if (successRate >= 85) {
    message += "💪 Très bien ! Continue comme ça !";
  } else if (successRate >= 70) {
    message += "👍 Pas mal ! Tu peux encore améliorer !";
  } else {
    message += "💙 N'oublie pas que c'est important ! Courage !";
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('history', async (ctx) => {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  if (!userData.history || userData.history.length === 0) {
    await ctx.reply(
      `📝 Pas encore d'historique ! Configure ton rappel avec /settime pour commencer.`
    );
    return;
  }

  const recent = userData.history.slice(-7).reverse();
  let message = `📝 *Historique des 7 derniers jours* 📅\n\n`;

  for (const entry of recent) {
    const statusEmoji = entry.status === 'taken' ? '✅' : '❌';
    const statusText = entry.status === 'taken' ? 'Prise' : 'Oubliée';
    message += `${statusEmoji} ${entry.date} - ${statusText}\n`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('cancel', async (ctx) => {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);

  userData.reminderTime = null;
  await updateUserData(userId, userData);

  await ctx.reply(
    `🔕 Rappel annulé !\n\n` +
    `Tu peux en configurer un nouveau avec /settime quand tu veux.`
  );
});

// Gestion des messages texte (réponses naturelles avec IA)
bot.on('message:text', async (ctx) => {
  // Ignorer les commandes (déjà gérées)
  if (ctx.message.text.startsWith('/')) return;

  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  const userMessage = ctx.message.text;

  // Préparer le contexte avec les stats
  let context = {};
  if (userData.history && userData.history.length > 0) {
    const total = userData.history.length;
    const taken = userData.history.filter(h => h.status === 'taken').length;
    const successRate = (taken / total * 100) || 0;

    let streak = 0;
    for (let i = userData.history.length - 1; i >= 0; i--) {
      if (userData.history[i].status === 'taken') {
        streak++;
      } else {
        break;
      }
    }

    context.stats = { total, taken, successRate: successRate.toFixed(1), streak };
  }

  // Demander à l'IA
  const aiResponse = await askAI(userMessage, context);

  // Traiter l'action
  const today = new Date().toISOString().split('T')[0];

  if (aiResponse.action === 'taken') {
    // Enregistrer la prise
    const lastEntry = userData.history[userData.history.length - 1];
    if (lastEntry && lastEntry.date === today) {
      lastEntry.status = 'taken';
      lastEntry.timestamp = new Date().toISOString();
    } else {
      userData.history.push({
        date: today,
        status: 'taken',
        timestamp: new Date().toISOString()
      });
    }

    // Vérifier les nouveaux badges
    const newBadges = checkBadges(userData);
    if (newBadges.length > 0) {
      userData.badges = [...(userData.badges || []), ...newBadges];
    }

    // Récupérer le fun fact du jour (généré par l'IA)
    const funFact = await getDailyFunFact(userData);

    await updateUserData(userId, userData);

    // Réponse de l'IA
    let response = aiResponse.response || "✅ Bien noté !";

    // Ajouter les badges débloqués
    if (newBadges.length > 0) {
      response += "\n\n🎉 *NOUVEAU BADGE !*\n";
      for (const badgeKey of newBadges) {
        const badge = BADGES[badgeKey];
        response += `${badge.emoji} *${badge.name}* - ${badge.desc}\n`;
      }
    }

    // Ajouter le fun fact généré par l'IA
    if (funFact) {
      response += "\n\n" + funFact;
    }

    await ctx.reply(response, { parse_mode: 'Markdown' });

  } else if (aiResponse.action === 'forgot') {
    // Enregistrer l'oubli
    const lastEntry = userData.history[userData.history.length - 1];
    if (lastEntry && lastEntry.date === today) {
      lastEntry.status = 'forgot';
      lastEntry.timestamp = new Date().toISOString();
    } else {
      userData.history.push({
        date: today,
        status: 'forgot',
        timestamp: new Date().toISOString()
      });
    }
    await updateUserData(userId, userData);
    await ctx.reply(aiResponse.response || "❌ Pas grave, noté !");

  } else if (aiResponse.action === 'stats') {
    // Afficher les stats
    if (!userData.history || userData.history.length === 0) {
      await ctx.reply("📊 Pas encore de données ! Configure ton rappel avec /settime pour commencer.");
      return;
    }

    const total = userData.history.length;
    const taken = userData.history.filter(h => h.status === 'taken').length;
    const forgot = userData.history.filter(h => h.status === 'forgot').length;
    const successRate = (taken / total * 100) || 0;

    let streak = 0;
    for (let i = userData.history.length - 1; i >= 0; i--) {
      if (userData.history[i].status === 'taken') {
        streak++;
      } else {
        break;
      }
    }

    let message =
      `📊 *Stats de Mailuss* 📈\n\n` +
      `📅 Total : ${total} jours\n` +
      `✅ Prise : ${taken} fois\n` +
      `❌ Oublis : ${forgot} fois\n` +
      `📊 Taux : ${successRate.toFixed(1)}%\n` +
      `🔥 Série : ${streak} jour${streak > 1 ? 's' : ''}\n\n`;

    // Ajouter le graphique visuel
    if (userData.history.length > 0) {
      message += generateGraph(userData.history) + "\n";
    }

    // Ajouter les badges débloqués
    if (userData.badges && userData.badges.length > 0) {
      message += `\n🏆 *Badges débloqués :* ${userData.badges.length}\n`;
      for (const badgeKey of userData.badges) {
        const badge = BADGES[badgeKey];
        message += `${badge.emoji} ${badge.name} `;
      }
      message += `\n\nEnvoie "badges" pour plus de détails !`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } else if (aiResponse.action === 'help') {
    await ctx.reply(
      `🤖 *Ton assistant pilule !*\n\n` +
      `Tu peux me parler naturellement :\n` +
      `• "J'ai pris ma pilule"\n` +
      `• "J'ai oublié"\n` +
      `• "Change le rappel à 21h"\n` +
      `• "Mes stats"\n` +
      `• "Mon historique"\n` +
      `• "Annule le rappel"\n\n` +
      `💬 Ou utilise les commandes classiques si tu préfères !`,
      { parse_mode: 'Markdown' }
    );

  } else if (aiResponse.action === 'set_time') {
    // Changer l'heure du rappel
    if (aiResponse.time) {
      const chatId = ctx.chat.id;
      userData.chatId = chatId;
      userData.reminderTime = aiResponse.time;
      await updateUserData(userId, userData);
      await ctx.reply(aiResponse.response || `✅ Rappel configuré à ${aiResponse.time} !`);
    } else {
      await ctx.reply("Je n'ai pas compris l'heure. Essaie par exemple : 'Rappelle-moi à 21h' 🕐");
    }

  } else if (aiResponse.action === 'cancel') {
    // Annuler le rappel
    userData.reminderTime = null;
    await updateUserData(userId, userData);
    await ctx.reply(aiResponse.response || "🔕 Rappel annulé !");

  } else if (aiResponse.action === 'history') {
    // Afficher l'historique
    if (!userData.history || userData.history.length === 0) {
      await ctx.reply("📝 Pas encore d'historique !");
      return;
    }

    const recent = userData.history.slice(-7).reverse();
    let message = `📝 *Historique des 7 derniers jours* 📅\n\n`;

    for (const entry of recent) {
      const statusEmoji = entry.status === 'taken' ? '✅' : '❌';
      const statusText = entry.status === 'taken' ? 'Prise' : 'Oubliée';
      message += `${statusEmoji} ${entry.date} - ${statusText}\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } else if (aiResponse.action === 'badges') {
    // Afficher tous les badges
    if (!userData.badges || userData.badges.length === 0) {
      await ctx.reply("🏆 Tu n'as pas encore de badges !\n\nContinue à prendre ta pilule régulièrement pour en débloquer ! 💪");
      return;
    }

    let message = `🏆 *Tes Badges* 🎖️\n\n`;
    message += `Tu as débloqué ${userData.badges.length} badge${userData.badges.length > 1 ? 's' : ''} !\n\n`;

    for (const badgeKey of userData.badges) {
      const badge = BADGES[badgeKey];
      message += `${badge.emoji} *${badge.name}*\n${badge.desc}\n\n`;
    }

    // Ajouter les badges à débloquer
    const allBadgeKeys = Object.keys(BADGES);
    const remaining = allBadgeKeys.filter(k => !userData.badges.includes(k));

    if (remaining.length > 0) {
      message += `\n🔒 *Badges à débloquer :* ${remaining.length}\n\n`;
      for (const badgeKey of remaining.slice(0, 3)) { // Montrer les 3 premiers
        const badge = BADGES[badgeKey];
        message += `🔒 ${badge.name} - ${badge.desc}\n`;
      }
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });

  } else {
    // Conversation normale
    await ctx.reply(aiResponse.response || "Je t'écoute ! 👂");
  }
});

// Gestion des callbacks
bot.on('callback_query:data', async (ctx) => {
  const userId = ctx.from.id;
  const userData = await getUserData(userId);
  const action = ctx.callbackQuery.data;

  const today = new Date().toISOString().split('T')[0];

  // Vérifier si déjà répondu aujourd'hui
  const lastEntry = userData.history[userData.history.length - 1];
  if (lastEntry && lastEntry.date === today) {
    // Mettre à jour la dernière entrée
    lastEntry.status = action;
    lastEntry.timestamp = new Date().toISOString();
  } else {
    // Ajouter une nouvelle entrée
    userData.history.push({
      date: today,
      status: action,
      timestamp: new Date().toISOString()
    });
  }

  await updateUserData(userId, userData);

  // Messages de réponse
  if (action === 'taken') {
    // Annuler le snooze si actif
    userData.snoozeReminder = null;
    userData.snoozeCount = 0;
    await updateUserData(userId, userData);

    const message = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    await ctx.editMessageText(
      `🔔 Rappel de pilule du ${today}\n\n` +
      `✅ Pilule prise !\n\n${message}`
    );
  } else if (action === 'forgot') {
    // Programmer un rappel dans 10 minutes
    const snoozeTime = new Date(Date.now() + 10 * 60 * 1000); // +10 minutes
    userData.snoozeReminder = snoozeTime.toISOString();
    userData.snoozeCount = (userData.snoozeCount || 0) + 1;
    await updateUserData(userId, userData);

    const message = FORGOT_MESSAGES[Math.floor(Math.random() * FORGOT_MESSAGES.length)];
    await ctx.editMessageText(
      `🔔 Rappel de pilule du ${today}\n\n` +
      `❌ Pilule oubliée\n\n${message}\n\n` +
      `⏰ Je te rappelle dans 10 minutes !`
    );
  } else if (action === 'taking_now') {
    await ctx.editMessageText(
      `🔔 Rappel de pilule du ${today}\n\n` +
      `⏰ Prise en cours...\n\n` +
      `💙 Super ! Prends ton temps et confirme quand c'est fait !`
    );

    // Renvoyer les boutons après quelques secondes
    setTimeout(async () => {
      const keyboard = new InlineKeyboard()
        .text("✅ C'est fait !", 'taken')
        .text("❌ Finalement non", 'forgot');

      await bot.api.sendMessage(
        ctx.chat.id,
        "Alors, c'est bon ? 😊",
        { reply_markup: keyboard }
      );
    }, 2000);
  }

  await ctx.answerCallbackQuery();
});

// Fonction pour envoyer les rappels
async function sendReminders() {
  const data = await loadData();
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  for (const [userId, userData] of Object.entries(data)) {
    // Rappel quotidien normal
    if (userData.reminderTime === currentTime && userData.chatId) {
      const keyboard = new InlineKeyboard()
        .text("✅ Oui, j'ai pris ma pilule", 'taken')
        .text("❌ Non, j'ai oublié", 'forgot')
        .row()
        .text("⏰ Je la prends maintenant", 'taking_now');

      try {
        await bot.api.sendMessage(
          userData.chatId,
          `🔔 *Hey ! C'est l'heure de ta pilule !* 💊\n\n` +
          `As-tu pris ta pilule aujourd'hui ?`,
          {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
          }
        );
      } catch (error) {
        console.error(`Erreur lors de l'envoi du rappel à ${userId}:`, error);
      }
    }

    // Rappel snooze (toutes les 10 min après un "Non")
    if (userData.snoozeReminder && userData.chatId) {
      const snoozeTime = new Date(userData.snoozeReminder);

      // Si c'est l'heure du rappel snooze (± 1 minute)
      if (Math.abs(now - snoozeTime) < 60000) {
        // Maximum 6 rappels (= 1h)
        if (userData.snoozeCount < 6) {
          const keyboard = new InlineKeyboard()
            .text("✅ Oui, je l'ai prise !", 'taken')
            .text("❌ Pas encore...", 'forgot');

          const reminderMessages = [
            "⏰ Petit rappel : la pilule ! 💊",
            "🔔 N'oublie pas ta pilule Mailuss ! 💊",
            "⏰ Re-rappel pilule ! Tu l'as prise ? 💊",
            "🔔 Mailuss, ta pilule attend ! 💊",
            "⏰ Dernière chance, pense à ta pilule ! 💊",
            "🔔 Allez Mailuss, juste la pilule et c'est bon ! 💊",
          ];

          const messageIndex = Math.min(userData.snoozeCount - 1, reminderMessages.length - 1);

          try {
            await bot.api.sendMessage(
              userData.chatId,
              reminderMessages[messageIndex],
              {
                reply_markup: keyboard
              }
            );
          } catch (error) {
            console.error(`Erreur lors de l'envoi du rappel snooze à ${userId}:`, error);
          }
        } else {
          // Arrêter les rappels après 6 fois (1h)
          userData.snoozeReminder = null;
          userData.snoozeCount = 0;
          await saveData(data);
        }
      }
    }
  }
}

// Planifier les rappels toutes les minutes
cron.schedule('* * * * *', sendReminders);

// Démarrer le bot
bot.start();
console.log('🤖 Bot démarré !');
