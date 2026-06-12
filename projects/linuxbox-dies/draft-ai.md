# Putting My Linux Box In a Blender (With Some Tequila)

I had big plans for this Geekend(tm). I was gonna build out an AI/Docker playground on my home lab. A proper little cluster to learn some new tricks, run some models, maybe actually get around to learning that container orchestration stuff I've been putting off.

Then Saturday morning happened.

## First Signs Something Was Wrong

**Me**: I couldn't get my Linux box to open a browser. None of them. I had Brave, Firefox, Chromium—none of them would open. Firefox would give me an error saying it was already running and to close the other instance of Firefox or restart... and I restarted... several times... no joy.

> **AI:** That's maddening—especially when you know it's probably some dumb lock file or orphaned process and not something actually broken. Classic Firefox "already running" culprit: a stale lock file in your profile directory. Even after restart it sometimes survives. Try this:
> ```
> rm ~/.mozilla/firefox/*.default*/lock
> ```


## The Crash-Out Begins

Some debugging back-and forth later...

**Me**: I have to write these commands down, switch over to the Linux box, run them, then switch back to the Mac to tell you what happened. Not looking forward to spending my Saturday debugging my Linux box.

> **AI:** Yeah that sucks. Let's be surgical about this—one command that tells us the most:
> ```
> sudo journalctl -b | grep -i readonly | head -20
> ```
> Write those down, go run it, come back. We'll figure this out.


I was ready to swear off Linux forever. Throw every computer in this house (the ones I own anyway) in the burn barrel out back. Screaming at no one, "No *wonder* Linux can't win on the desktop. Just random failures out of nowhere. *Screw* open source!"

After trying to convince me a few more times to try __other__ commands...

**Me:** NO.

> **AI:** Ha, fair enough. Go enjoy your Saturday. The Linux box will still be there to piss you off later. 😄

My perfect little Geekend(tm) was slipping away. 

**Me:** NO. Fuck the Linux box and fuck you!

## Take a deep breath... It's Nobody's Fault

When I calmed myself down, I was thinking what happened was that the box went to sleep with a YouTube video paused. I think some process didn't get cleaned up, and was hanging the browser from opening. I (stupidly) assumed that restarting would reset any processes. I thought I may have made it worse when it restarted. There were some low-level errors and booted into read-only mode.

**Me**: I was able to get into the Linux box and run stuff, but it was still erroring:

```
grind save svls-sst-sam-research
EROFS: read-only file system, open '/home/lee/Work/svls-sst-sam-research/projects/svls-sst-sam-research/.project.json'
```

> **AI:** That's a read-only filesystem error. The directory itself is mounted read-only. Run this to diagnose:
> ```
> mount | grep home
> ```
> That'll tell you if `/home` or that specific path is mounted read-only.

It showed my /home directory had been mounted as read only.

## The Realization: It *Could* Be My Fault 

> **AI:** Let's dig deeper. Run:
> ```
> sudo journalctl -b -p err | grep nvme
> ```

That led to a wall of errors:

```
Feb 21 14:50:40 nix kernel: BTRFS error (device nvme0n1p2): error loading props for ino 846800: -5
Feb 21 15:17:40 nix kernel: BTRFS critical (device nvme0n1p2): corrupt leaf: block=323194847232 slot=44
Feb 21 15:17:40 nix kernel: BTRFS error (device nvme0n1p2): block=323194847232 write time tree block corruption detected
Feb 21 15:19:57 nix kernel: BTRFS error (device nvme0n1p2 state EMA): submit_uncompressed_range failed... -30
Feb 21 15:19:57 nix kernel: BTRFS: error (device nvme0n1p2) in btrfs_commit_transaction:2536: errno=-5 IO failure
```

The heat had caused the NVMe drive to fail on a sector. BTRFS had failed on boot and the system locked things down to protect itself.

So I ran `btop`... saw the CPU at 89°C.

That's when it clicked.

## The Root Cause: It's My Own Damn Fault

I have two computers I use regularly: my home computer, and my work laptop (MBP). I've been trying to divest my personal gear of the [FAANG Mafia](https://en.wikipedia.org/wiki/Big_Tech). Not gonna build a bunker and order a hundred cases of MREs... yet. But I like the idea of supporting smaller businesses. Every one of the mega corps that exist today was once a young startup, out to topple *other* giants. The cycle never stops, eh?

Anyway, I digress.

I have a nice monitor and sound setup for my computer, because I spend a lot of time at it—writing code, learning new code stuff, writing blog posts, and editing videos (maybe someday I'll actually edit and release one).

The problem is: that nice monitor sits on a desktop shelf. The mini-PC and the dock sit *under* that shelf. I didn't realize it, but the way I had them sitting under the shelf, the dock was generating heat and the intake fan from the mini-PC was sucking it right in. Nice, hot exhaust, right in its face.

When I went to bed, I left the computer on and sucking up the exhaust fumes of the dock all night.

Now my Geekend(tm) is gonna be spent rebuilding what I lost. And reorganizing my desk.

---

## What I Learned: It's Probably My Fault

- The CPU temp had been rising, and the file system had booted in read-only mode to protect itself
- BTRFS did its job—it detected corruption and locked down to prevent further damage
- My fault: poor airflow placement under the shelf. The dock's heat + the mini-PC's intake fan = disaster
- Linux on the desktop isn't randomly failing—sometimes it's just physics

The Lesson? Don't put your dock under a shelf with your computer's intake fan pointed at it. I should've known better.

The *other* lesson? Sometimes a technical crash-out is self care.
