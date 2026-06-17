# Grind: A Terminal-First Workflow for Creative Projects

I've got ideas all the time. In the moment they can seem great, but after I've pondered them for a day or two, I realize it's either a dumb idea, not something I want to pursue, or not something I should do. For example, I had an idea for a cookbook, but I don't really cook. Even if it was a good idea, I probably _shouldn't_ be the one to write it.

I needed some way to capture these ideas, regularly triage the ideas and either:

- Take that idea and run with it. Start a new project.
- Donate the idea. If I think it's good, just not for me; put it on the HiP website's "Free Ideas" page.
- Scrap it. It ain't worth the time. And maybe lay off the Gelato #41.

Then, if I start a project from one of those ideas, I want to track all the work I do on it. Easily get in and grind on a project, track the time I'm spending on the project, create an invoice for the project (if I end up getting paid work), and keep track of it all. Mostly so that I can keep from overcommitting, leaving unfinished projects from great ideas just because I forgot about it.

I want it to be a command-line tool. I love the idea of staying in the terminal for as much of what I do as possible. Not just because I think it makes me look like a computer hacking wizard, but because when I narrow my focus to the terminal, it starts my mind down the path of narrowing my focus. Making it easier for me to get into that 'flow state' that we all seek, where the world around you just fades away and you're just 'in it'.

I'm hoping this system will facilitate getting into that place. The movie _Soul_'s **Astral Plane**. The easier my system can help me get there, the better.

Here goes nothing...

## Stage One: The Workflow (AKA The Grind)

This is me dog-fooding Grind. Using Grind to grind on... Grind.

I am writing this file after having run:

```
grind init
```

Which initialized a bare repo in the folder I ran it in (like a `git init`). It also creates a main working tree in a folder called `grind` at the root of the folder. It adds two folders inside: `ideas` and `projects`.

Then:

```
grind new idea "Build a system for managing creative project work, called Grind."
```

This created an idea file in the `ideas` directory called [timestamp].md.

Then, I can run:

```
grind ideas
```

Here, I can triage the ideas. It lists all the ideas out with an integer placeholder, like:

```
0. First idea.
1. Second, better idea.
2. THIS is the idea of ideas.
3. Build a system for managing creative project work, called Grind.
```

Then I find one I like and create a project for it by running:

```
grind new project "dogfood" 3
```

The number three is the number from the `grind list ideas` call. This creates a folder in projects named "dogfood" with one file in it called: `.project.json`. It has a structure like this:

```
{
  "name": "dogfood",
  "idea": "# Build a system for managing creative project work, called Grind.",
  "time": [],
  "billing": {
    "roundTo": "quarter-hour",
    "rate": 150
  }
}
```

It then commits that and makes a Git worktree with a folder in the root (as a sibling to "grind") named after the project, in this case: "dogfood". I can then work on that project by running:

```
grind work "dogfood"
```

This switches me to the working tree, to the "dogfood" folder in "[base]/dogfood/projects", adds a time session to the `.project.json` file:

```
{
  "name": "dogfood",
  "idea": "# Build a system for managing creative project work, called Grind.",
  "time": [
    {
      "start": "2026-01-25T14:36:29.535Z",
      "end": null,
      "duration": 0,
      "rounded": 0
    }
  ],
  "billing": {
    "roundTo": "quarter-hour",
    "rate": 150
  }
}
```

It also opens the project in NeoVim (will be configurable later).

When I am finished, I exit NeoVim and run:

```
grind save "dogfood"
```

This adds a timestamp to the "end" value of the open time session, and calculates the time exactly and rounded by the rounding setting in the "billing" section.

It also stages and commits any changes to git. This way I never forget to close a work session's timer and lose track of the time. It checks to see if there are any changes to commit, first.

## Did You Say, "Git _Worktrees_"? WTF Is That?

I've got to make a whole separate blog post about Git worktrees, but it is changing how I see and use Git. Here are the basics of how they fit in to the Grind CLI.

Worktrees are separate folders that are "tied" to a work branch. That's basically it.

The `grind init` command creates a _bare_ repository called `.grind.repo.git`. This is _just_ the stuff that would be in the `.git` folder in a regular git repo. It helps coordinate all the changes between worktrees. It also creates a Git worktree named `grind` right next to it. This is the source of truth. Your 'main' branch.

As I `grind new project my-project 2`, grind creates a new worktree with a folder that is a sibling to the `grind` and `.grind.repo.git` folders.

I'm just sitting in the root workspace directory (wherever I ran `grind init`), and running `grind [command]`.

```
grind ideas   // lists the current idea pool

grind projects // list all my current projects

grind work my-project   // starts a work timer and opens NVIM in the project directory

grind save my-project   // saves all my work and stops the timer

grind publish my-project    // currently merges the worktree branch back into main
```

Each time I start a `new project` Grind creates a new worktree with the project name in a directory that is a sibling to my main worktree and the bare repo.

Each directory is checked out to a branch with the same name. When I want to work on a feature, all I really need to do is change into that directory. If I need to do something on the main branch, I just change into that `grind` directory. Grind does all this for me in the commands, and when I am done working in NVIM (writing this blog post), I leave NVIM and I'm back in the root workspace directory, and I can save and stop work on that branch.

Look for a blog post in the near future exploring Git Worktrees in more depth.

## A Dash of Configuration

The root working tree (grind), where the main branch lives, has a file at its root called:

```
.grind.json
```

This has default values. Right now, it's just billing defaults. (and wishful thinking on the rate).

```
{
  "billing": {
    "roundTo": "quarter-hour",
    "defaultRate": 150
  }
}
```

The `.project.json` in each project folder allows me to override that base billing rate or time rounding to satisfy a client (when I have some).

I will eventually add more configurable stuff, like the default editor that opens when you run `grind work start "[project-name]"`, etc.

## Seeing Where I'm At (AKA Not Overcommitting)

To keep me from overcommitting, I am adding some listing commands, like:

```
grind projects
```

This lists all the current projects with some information about the project, like how long I've spent working on it, when I last worked on it, etc. That way, I can see what projects I currently have in flight, and decide if I want to continue or if it's time to 'call it' on that project. Something like:

```
 Project                        Type  Hours                     Sessions    Last Worked
 ─────────────────────────────  ────  ────────────────────────  ──────────  ───────────
  long-running-projects-feature  —     0.0h                              0  never
  hobby-blog-post                blog  0.3h (0.3h unbilled)              1  23h ago
  svls-sst-sam-research          blog  4.0h (4.0h unbilled)              2  22h ago
  dogfood                        —     10.5h (10.5h unbilled)           18  40m ago
```

This is the kind of information that can help me decide to continue or drop a project. It also lets me know I have four projects currently in flight. I probably shouldn't take on any more personal projects. I'm not going to build in a hard WIP limit right now, but if I start seeing ten projects in flight, that might be something I have to consider.

I also added a `grind status` command that lists the state the projects are in: version-control-wise. Just runs a `git status` on each project worktree.

```
[dogfood]
  On branch dogfood
  Changes not staged for commit:
    (use "git add <file>..." to update what will be committed)
    (use "git restore <file>..." to discard changes in working directory)
  	modified:   projects/dogfood/.project.json

  no changes added to commit (use "git add" and/or "git commit -a")

[main]
  On branch main
  nothing to commit, working tree clean

[hobby-blog-post]
  On branch hobby-blog-post
  nothing to commit, working tree clean

[long-running-projects-feature]
  On branch long-running-projects-feature
  nothing to commit, working tree clean

[svls-sst-sam-research]
  On branch svls-sst-sam-research
  nothing to commit, working tree clean
```

This lets me know I have work pending on my dogfood project (which is me using and developing the Grind CLI). I can run a `grind save dogfood` and it will stop the timer and commit those changes. For now...

## Coming Up, On Next Week's Episode Of Lost Causes

I've also got some plans for a few more commands like:

```
grind publish -hg "blog-post-project"
```

For blog posts. Will copy them to my [Human In Progress](https://www.humaninprogress.live/) website (the -h) and to my [GarageMahal Studios](https://www.garagemahal.studio/) website (the -g).

```
grind review "blog-post"
```

Asks my writing AI Agent to review and give me a revised copy.

```
grind finalize "blog-post"
```

Sends the final draft of a blog post to my editor AI agent, so it can learn which of its recommendations I kept and which ones I didn't.

```
grind promo "blog-post"
```

Will read settings from .project.json in the blog-post folder which should have published URLs in them and kick off content promotion cycle with make.com.

## So Far, So Good, So NOW What?

I'm liking it so far, and since I am building it myself, I can change it to suit my own workflow. It will definitely make me better at Git. It already has. I didn't know diddly about Git Worktrees, so when I learned about them I realized they might be the perfect fit for this use case.

I'm also writing the CLI in TypeScript with Bun, which has been a blast. Way easier than I expected (I let Opus 4.5 scaffold the project so I didn't have to go through the "how do you set up Bun" phase).

Stay tuned for more tales from the weird side.

Adding top the idea
