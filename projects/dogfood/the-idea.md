# Grind: The Idea 

I've been wanting to build a framework that I could *live* in to do my projects. Starting with my personal writing projects: LinkedIn posts, blog posts, even books. I also will write some scripts for youtube videos, songs, and even coding projects, like this.

The point is that the project should allow me to just grind. Just work. I can jump into it and add ideas, promote those ideas to projects, work on projects with a timer running, and even (eventually) publish written works.

## Stage One: The Workflow (AKA The Grind)

This is me dog-fooding Grind. Using Grind to grind on... Grind.

I am writing this file after having run:

```
gd init
```

Which initialized a bare repo in the folder I ran it in (like a `git init`). It also creates a main working tree called in a folder called "grind" at the root of the folder. It adds two folders inside: `ideas` and `projects`.

Then:

```
gd new idea "Build a system for managing creative project work, called Grind."
```

This created an idea file in the `ideas` directory called [timestamp].md.

Then, I can run:

```
gd list ideas
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
gd new project "dogfood" 3
```

The number three is the number from the `gd list ideas` call. This creates a folder in projects named "dogfood" with one file in it called: `.project.json`. It has a structure like this:

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

It then commits that and makes a worktree with a folder in the root (as a sibling to "grind") named after the project, in this case: "dogfood". I can then work on that project by running:

```
gd work start "dogfood"
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
gd work stop "dogfood"
```

This adds an timestamp to the "end" value of the open time session, and calculates the time exactly and rounded by the rounding setting in the "billing" section.

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

The `.project.json` in each project folder allows me to override that base billing rate or time rounding to satisfy client (when I have some).

I will eventually add more configurable stuff, like the default editor that opens when you run `gd work start "[project-name]"`, etc.

## The Next Stage

Next, I need to add some convenience commands to set config values, like:

```
gd config billing:rate 95
```

That should set the billing rate for the project I am in to $95/hr.

```
gd config --global billing:rate 125/hr
```

For when I figure out nobody will pay my extortionate bill rate.

I've also got some plans for a few more commands like:

```
gd publish -hg "blog-post-project" // for blog posts. copies them to my Human In Progress website (the -h) and to my GMH.services website (the -g)
```

```
gd review "blog-post" // asks my writing AI Agent to review and give me a revised copy
```

```
gd finalize "blog-post" // sends the final draft of a blog post to my editor AI agent, so it can learn which of it's recommendations I kept and which ones I didn't
```

```
gd promo "blog-post" // will read settings from .project.json in the blog-post folder which should have published URLs in them and kick off content promotion with make.com 
```

## So Far, So Good, So What? (\m/)

I'm liking it so far, and since I am building it myself, I can change it to suit my own workflow. It will definitely make me better at Git. It already has. I didn't know diddly about Git Worktrees, so when I learned about them I realized they might be the perfect fit for this use case. 

I'm also writing the CLI in TypeScript with Bun, which has been a blast. Way easier than I expected (I let Opus 4.5 scaffold the project so I didn't have to go through the "how do you set up Bun" phase).

Stay tuned for more tales from the weird side.



