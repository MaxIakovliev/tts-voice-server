uvicorn app.main:app --reload --port 8081

uvicorn app.main:app --host 0.0.0.0 --port 8081 --reload

## how to run without certificate:

```bash
uvicorn app.main_websocket:app --host 127.0.0.1 --port 8000 --reload
```

## how to run websocker server using https certificate:

```bash

uvicorn app.main_websocket:app --host 0.0.0.0 --port 8080 --reload --ssl-keyfile key.pem --ssl-certfile cert.pem

```


## how to build a container

```bash

docker build -t tts-voice-server .

```

## how to run container

```bash

docker run  --name my-tts-voice-server -p 8000:8000 tts-voice-server

```


http://localhost:8081/admin
http://localhost:8081/
https://www.reddit.com/r/LocalLLaMA/comments/1ckw7en/what_software_do_you_use_to_interact_with_local/


here's an extended list of detailed technical features that a robust voice chat application should support:

- <input type="checkbox" checked> Add  function "end call"
- <input type="checkbox" checked> Add  button  "end call"
- <input type="checkbox" checked> Assign function "end call" on button

- <input type="checkbox" checked> Added support of https
- <input type="checkbox" checked> write in  readme - how to use https
- <input type="checkbox" checked> Test https connection
- <input type="checkbox" checked> Test join room functionality from different machine
- <input type="checkbox" checked> Support of Creation of Rooms on Server
- <input type="checkbox" checked> Create method on server - to return list of active rooms on the server
- <input type="checkbox" checked> Update UI and javascript code to download list of  list of active rooms from the server
- <input type="checkbox" checked> Create docker image for this service
- <input type="checkbox" checked> Test docker image
- <input type="checkbox" unchecked> Createroom/join room page
- <input type="checkbox" unchecked> On create room - route to another page
- <input type="checkbox" checked> Mute/Unmute Microphone


- Users Should Be Able to Join Existing Rooms if They Know the Code of the Room
- Users Should Be Able to Leave Rooms
- Users Should Be Able to Talk to Other Participants in the Room by Voice
- Noise Reduction
- Detect Silence on Client Side and Do Not Send Data When Silence is Detected
- Chat to the Group via Text Inside of the Room
- Record Audio of Every Room
- Transcribe Audio
- End-to-End Encryption

- User Authentication and Authorization
- Display a List of Participants in the Room
- User Presence Notifications (Join/Leave Notifications)
- Push-to-Talk Functionality
- Adjustable Audio Quality Settings
- Volume Control for Individual Participants
- File Sharing Within the Room
- Emojis and Reactions in Text Chat
- Moderator Controls (e.g., Mute/Unmute Others, Remove Users)
- Screen Sharing
- Integration with External Authentication Providers (e.g., OAuth, SSO)
- Support for Multiple Languages
- Automatic Language Translation in Text Chat
- Customizable Room Settings (e.g., Password Protection, Room Name)
- Activity Logs and History for Text Chats
- Notifications for Missed Messages or Calls
- Cross-Platform Support (Web, Mobile, Desktop)
- Low Bandwidth Mode
- Background Noise Suppression
- Integration with Calendar for Scheduled Meetings
- High Availability and Scalability
- Quality of Service (QoS) Metrics and Monitoring
- Support for Different Audio Codecs
- Recording Consent Notifications
- In-Room Announcements by Admins/Moderators
- Custom User Avatars and Profiles
- Voice Activity Indicators
- Multiple Room Management for Users (e.g., Switch Between Rooms)
- Real-Time Language Translation for Voice
- Support for Custom Plugins or Extensions
- Analytics and Reporting for Room Usage and Activity
- Integration with CRM or Other External Tools
- Support for Bots and Automation (e.g., Meeting Reminders, Summarization Bots)
- Geolocation-Based Room Suggestions
- Support for Virtual Backgrounds or Video Effects in Screen Sharing
- Multi-Tenant Support for Organizations
- Feedback Mechanism for Users (e.g., Rate Call Quality)
- User Roles and Permissions Management
- Custom Branding and Theming for Rooms
- Accessibility Features (e.g., Screen Reader Support, Subtitles)
- Data Export Options for Recorded Audio and Transcriptions
- Integration with Payment Systems for Paid Rooms or Features
- Offline Mode for Text Chat with Syncing When Back Online
- AI-Based Speaker Recognition
- Support for Multiple Simultaneous Conversations within the Same Room
- Voice Command Integration for Control (e.g., "Mute my mic")
- Mobile-Friendly Interface and Performance Optimization
- Periodic Automated Backups of Room Data