# LocOutil — Gestion de location d'outils

Application web de gestion de location d'outils. Permet de gérer le catalogue d'outils, les clients, les réservations, les annonces sur les plateformes et d'avoir une vue calendrier de la disponibilité.

## Fonctionnalités

### Outils
- Fiche outil : nom, catégorie, description, photos multiples (upload)
- Tarifs : prix à la journée, prix week-end, caution
- Notes internes
- Historique des locations par outil
- **Lightbox** : clic sur une photo → plein écran avec navigation (← →) et bouton téléchargement

### Clients
- Fiche client : nom, téléphone, email, adresse, notes
- Upload de documents (pièces d'identité, etc.) avec libellé personnalisable
- Historique des locations par client

### Locations
- Lien outil + client + plateforme + dates
- Calcul automatique du prix selon la durée
- Suivi caution (encaissée / rendue)
- Statuts : Confirmée / En cours / Retournée / Annulée
- Notes de retour (état de l'outil à la restitution)

### Calendrier
- Vue mensuelle grille 7 colonnes
- Chaque outil a une couleur fixe pour identification rapide
- Légende des outils du mois
- Week-ends et aujourd'hui visuellement différenciés
- Clic sur un événement pour voir le détail

### Annonces
- Vue matricielle outils × plateformes
- Statut par cellule : active (✓ vert) / inactive (✗ rouge) / absente (+ pointillé)
- Fiche annonce par outil/plateforme : titre, texte, prix, lien, notes
- Bouton **Copier** pour copier l'annonce prête à coller sur la plateforme
- Utile pour republier rapidement une annonce expirée

### Plateformes
- Liste éditable (Leboncoin, Direct, etc.)
- Utilisée dans les locations et les annonces

### Dashboard
- Locations en cours, revenus du mois, revenus total
- Cautions en attente de retour
- Retours prévus dans les 7 jours

## Stack

- **Backend** : Python FastAPI + SQLite
- **Frontend** : HTML/CSS/JS vanilla
- **Déploiement** : Docker + Traefik

## Déploiement

```bash
cd /opt/container/locoutil
docker compose up -d --build
```

Accessible sur **https://locoutil.nas.percolouco.com**

## Structure

```
locoutil/
├── app/
│   ├── main.py              # App FastAPI + dashboard
│   ├── database.py          # SQLite + schéma
│   └── routers/
│       ├── tools.py         # CRUD outils + images (upload)
│       ├── clients.py       # CRUD clients + documents
│       ├── rentals.py       # CRUD locations + calendrier
│       ├── platforms.py     # CRUD plateformes
│       └── listings.py      # CRUD annonces (matrice outil × plateforme)
├── static/
│   ├── style.css
│   └── app.js
├── templates/
│   └── index.html
├── Dockerfile
└── requirements.txt
```

Les données sont persistées dans `/opt/container/locoutil/data/` (SQLite) et `/opt/container/locoutil/uploads/` (images outils et documents clients).
