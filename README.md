# SCT Slack Web Application (Sadhana Creation Team)

Custom team collaboration, direct messaging (DMs), and real-time chat platform modeled after Slack.

---

## 🌟 Key Features

1. **Clean Username & Password Sign-In:**
   - Simple, focused sign-in card.
   - Default password for all team members: `sct@123`.
   - "Keep me signed in for 20 days" session persistence.
   - Clean "Sign Out" button to exit session at any time.

2. **Direct Messages (1-on-1 Private DMs):**
   - Click any team member in the "Direct Messages" section to open a private conversation.
   - Only the two participants have access to these messages.
   - Live presence indicator (🟢 Online / ⚪ Offline).

3. **Message Deletion (Permanent DB Deletion):**
   - Users can delete their own messages by hovering over them and clicking the trash can icon (`🗑️`).
   - HOD / Admin can delete any message.
   - The message is deleted permanently from the MySQL database (`SCT_messages`) and instantly removed for everyone in real time.

4. **Channel Editing & Management (Admin):**
   - HOD / Admin can click the "Edit" button in any channel header to:
     - Rename channel
     - Update channel description
     - Configure posting rights (`All Members`, `HOD + Leaders Only`, or `Admin Only`)
     - Delete custom channels permanently.

5. **WhatsApp / Slack Style Unread Badges:**
   - Unread message counters (green badge `[1]`, `[2]`) appear beside channels and direct messages whenever new messages arrive.
   - Clicking into the channel/DM clears the badge.
   - Clicking a notification immediately dismisses it and jumps directly into the conversation.

6. **Full English UI & Multi-language Chat Support:**
   - 100% English user interface (sidebar, buttons, modals, settings, headers).
   - Users can chat freely in Gujarati, English, or Hindi!

---

## 👥 Team Login Credentials (Username & Password Pairs)

| Display Name | Username | Password | Role | Team |
| :--- | :---: | :---: | :---: | :---: |
| **Khush Maharaj** | `s112` | `s112` | HOD / Admin | Management |
| **P Haripryaswami** | `111` | `111` | Leader | Team 1 |
| **P Swayamprakashswami** | `112` | `112` | Member | Team 1 |
| **Parthiv Maharaj** | `s120` | `s120` | Member | Team 1 |
| **Chintan Maharaj** | `s108` | `s108` | Member | Team 1 |
| **P Hariprakashswami** | `114` | `114` | Leader | Team 2 |
| **P Haridarshanswami** | `115` | `115` | Member | Team 2 |
| **Abhishek Maharaj** | `s116` | `s116` | Member | Team 2 |
| **Jaydeep Maharaj** | `s119` | `s119` | Member | Team 2 |

---

## 🗄️ Database Architecture (MySQL on Hostinger)

- **Database:** `u339048620_stkreq`
- **Username:** `u339048620_stkreq`
- **Host:** `auth-db1408.hstgr.io`
- **Table Prefix:** `SCT_`
  - `SCT_users` (Name, password, role, team_name, avatar)
  - `SCT_channels` (Channels & DMs, `is_direct`, `post_permission`)
  - `SCT_channel_members` (Channel memberships)
  - `SCT_messages` (Messages, file attachments, timestamps)
  - `SCT_notifications` (In-app notifications)

---

## 🚀 How to Run

### Live Server:
```bash
npm start
```
👉 Open in browser: **`http://localhost:5000`** (or **`http://localhost:5173`**)

### Access on Mobile / Tablet (Same Wi-Fi):
👉 Open in phone browser: **`http://192.168.0.205:5000`**
