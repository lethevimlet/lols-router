# PM2 Auto-Start Configuration

## Enable PM2 to start on system boot

To ensure lols-router automatically starts after a reboot, you need to configure PM2's startup system.

### Steps (on remote server 192.168.0.21):

1. **SSH into the server:**
   ```bash
   ssh ai@192.168.0.21
   ```

2. **Generate the startup command:**
   ```bash
   pm2 startup
   ```

3. **Run the command it provides** (example output):
   ```bash
   sudo env PATH=$PATH:/home/ai/.nvm/versions/node/v24.13.0/bin \
     /home/ai/.nvm/versions/node/v24.13.0/lib/node_modules/pm2/bin/pm2 startup systemd \
     -u ai --hp /home/ai
   ```
   
   Copy and paste the exact command from your output and run it with sudo.

4. **Save the current PM2 process list:**
   ```bash
   pm2 save
   ```

5. **Verify it's enabled:**
   ```bash
   systemctl --user status pm2-ai.service
   ```
   or
   ```bash
   sudo systemctl status pm2-ai.service
   ```

### Alternative: Quick Setup Script

From your local machine:
```bash
cd projects/lols-router
npm run setup-startup
```

This will guide you through the process.

### Current Status

As of 2026-02-15:
- ✅ PM2 process list saved (`pm2 save` completed)
- ⚠️ Systemd startup NOT yet configured (requires sudo on remote)
- 🔄 Manual setup required (see steps above)

### Verify Auto-Start

After configuration, reboot the server and check:
```bash
ssh ai@192.168.0.21 "pm2 list"
```

You should see lols-router running automatically.

### Troubleshooting

**Issue:** `sudo: a terminal is required to read the password`
- **Solution:** Run the commands directly on the server (SSH in), not via remote-helper

**Issue:** Service not found after reboot
- **Solution:** Ensure you ran `pm2 save` after starting your processes
- **Solution:** Check if the systemd service is enabled: `systemctl is-enabled pm2-ai.service`
