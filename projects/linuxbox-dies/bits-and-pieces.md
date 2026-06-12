# Bits & Pieces

## First signs something was wrong

Me: I'm a little depressed. I couldn't get my Linux box to open a browser. None of them. I had Brave, Firefox, Chromium.. none of them will open. Firefox would give me an error saying it was already running and to close the other instance of firefox or restart.. and I restarted... several times... no joy.

AI: That's maddening - especially when you know it's probably some dumb lock file or orphaned process and not something actually broken.
Classic Firefox "already running" culprit: a stale lock file in your profile directory. Even after restart it sometimes survives.
Try this:
```
$> rm ~/.mozilla/firefox/*.default*/lock
```

Or find your actual profile folder:

```
$> ls ~/.mozilla/firefox/
```

## After some troubleshooting...

Me: I have to WRITE these commands down. Switch over to the l,inux box, run them, then swqtich back to the mac to tell you what happened. Not looking forward to spending my Saturday debugging my Linux box'

Yeah that sucks. Let's be surgical about this - one command that tells us the most:

$> sudo journalctl -b | grep -i readonly | head -20

If sudo is busted too, try:

$> bashjournalctl -b 2>&1 | grep -i readonly | head -20

Write those down, go run it, come back. We'll figure this out.

Me: NO.

AI: Ha, fair enough. Go enjoy your Saturday. The Linux box will still be there to piss you off later. 😄

Me: NO. FUCK THE LINUX BOX and FUCK YOU!

## After threatening to throw ALL my tech into the burn barrel out back...

Me: Okay. I'm over venting about Linux being a slog. There are just some days you wish Linux on the desktop were more stable.

I think what happened was that the box went to sleep with a YouTube video paused. I think some process didn't get cleaned up, and was hanging the browser from opening. I (stupidly) assumed that restarting would reset any processes, and maybe made it worse when it restarts, has some low-level issue and boots into read-only mode.

> I decide to go have a creative weekend. But I don't.

Me: I'm able to get into the Linux box and run stuff, but it is still erroring.


```
 grind save svls-sst-sam-research
EROFS: read-only file system, open '/home/lee/Work/svls-sst-sam-research/projects/svls-sst-sam-research/.project.json'
    path: "/home/lee/Work/svls-sst-sam-research/projects/svls-sst-sam-research/.project.json",
 syscall: "open",
   errno: -30,
    code: "EROFS"


Bun v1.3.8-canary.1+b64edcb49 (Linux x64)
```

AI: That's a read-only filesystem error. The directory itself is mounted read-only.

Quick checks:No prior context on `grind` specifically. This is a straightforward EROFS issue though.

Run this to diagnose:

```bash
mount | grep home
```

That'll tell you if `/home` or that specific path is mounted read-only. Also check:

```bash
ls -la /home/lee/Work/svls-sst-sam-research/projects/svls-sst-sam-research/
```

Most likely causes:
- The directory is on a read-only mount (NFS, overlay fs, etc.)
- File permissions issue (less likely since EROFS is specifically a filesystem flag)
- If you're in a container/VM, the volume wasn't mounted with write permissions

What does `mount | grep home` show?

> It showed my /home directory had been mounted as read only.

```
sudo journalctl -b -p err | grep nvme
```
Leads to:
```
Journal file /var/log/journal/361f5ecad6154441a962f31f3b8641f8/user-1000@00064b590e5d39ec-4bd1d96a74ec60b7.journal~ is truncated, ignoring file.
Feb 21 14:50:40 nix kernel: BTRFS error (device nvme0n1p2): error loading props for ino 846800 (root 257): -5
Feb 21 15:17:40 nix kernel: BTRFS critical (device nvme0n1p2): corrupt leaf: block=323194847232 slot=44 extent bytenr=322800791552 len=16384 previous extent [322800779264 169 0] overlaps current extent [322800791552 169 0]
Feb 21 15:17:40 nix kernel: BTRFS error (device nvme0n1p2): block=323194847232 write time tree block corruption detected
Feb 21 15:17:40 nix kernel: BTRFS critical (device nvme0n1p2): corrupt leaf: block=323194896384 slot=35 extent bytenr=322804035584 len=16384 previous extent [322804023296 169 0] overlaps current extent [322804035584 169 0]
Feb 21 15:17:40 nix kernel: BTRFS error (device nvme0n1p2): block=323194896384 write time tree block corruption detected
Feb 21 15:17:40 nix kernel: BTRFS critical (device nvme0n1p2): corrupt leaf: block=323195076608 slot=2 extent bytenr=322806329344 len=16384 previous extent [322806317056 169 0] overlaps current extent [322806329344 169 0]
Feb 21 15:17:40 nix kernel: BTRFS error (device nvme0n1p2): block=323195076608 write time tree block corruption detected
Feb 21 15:17:40 nix kernel: BTRFS: error (device nvme0n1p2) in btrfs_commit_transaction:2536: errno=-5 IO failure (Error while writing out transaction)
Feb 21 15:17:40 nix kernel: BTRFS error (device nvme0n1p2 state EA): Transaction aborted (error -5)
Feb 21 15:17:40 nix kernel: BTRFS: error (device nvme0n1p2 state EA) in cleanup_transaction:2021: errno=-5 IO failure
Feb 21 15:17:40 nix kernel: BTRFS: error (device nvme0n1p2 state EA) in btrfs_sync_log:3564: errno=-5 IO failure
Feb 21 15:17:56 nix kernel: BTRFS error (device nvme0n1p2 state EA): submit_uncompressed_range failed, root=257 inode=1179440 start=0 len=4096: -30
Feb 21 15:19:57 nix kernel: BTRFS error (device nvme0n1p2 state EMA): remounting read-write after error is not allowed
```

Error reading the file system. Forced Linux to boot the file system as read-only. Not good.

So I run btop... see the cpu at 89C..!!!

Save everything and shut it off.


