# README

- Personal dotfiles, based on https://www.atlassian.com/git/tutorials/dotfiles
- These have been developed on MacOS (Big Sur)

## Installation

On a new Apple Mac:

```
alias config='/usr/bin/git --git-dir=$HOME/.cfg/ --work-tree=$HOME'
echo "alias config='/usr/bin/git --git-dir=$HOME/.cfg/ --work-tree=$HOME'" >> $HOME/.zprofile
```

Then checkout the config files from this git repo (https://github.com/paulcoghlan/dotfiles.git):
```
git clone --bare https://github.com/paulcoghlan/dotfiles.git $HOME/.cfg
config config --local status.showUntrackedFiles no
config checkout
```

## Usage

1. Add the alias `alias config='/usr/bin/git --git-dir=$HOME/.cfg/ --work-tree=$HOME'` to `.zprofile`
2. Use the `config` alias to commit to the dotfile repo, e.g. to add a `.vimrc` change:

```
config add .vimrc
config commit -m "Add vimrc"
config push 
```

## Oh My Zsh Customization

This repository includes a custom Oh My Zsh theme that's managed separately from the main Oh My Zsh installation.

### Custom Theme Setup

The custom theme `mytheme` is stored in `~/.zsh-themes/` and symlinked to the Oh My Zsh custom themes directory. This allows the theme to be version controlled in this dotfiles repository while remaining accessible to Oh My Zsh.

**Theme Features:**
- Current time display
- Directory path in cyan
- Git branch information in magenta
- Time since last git commit (showing seconds/minutes/hours/days)
- Green prompt character (❯)

### Managing the Theme

To update the theme:
1. Edit the file at `~/.zsh-themes/mytheme.zsh-theme`
2. Commit changes using the `config` alias:
   ```bash
   config add .zsh-themes/mytheme.zsh-theme
   config commit -m "Update custom Zsh theme"
   config push
   ```

### Recreating the Symlink (if needed)

If the symlink gets broken, recreate it with:
```bash
ln -s ~/.zsh-themes/mytheme.zsh-theme ~/.oh-my-zsh/custom/themes/mytheme.zsh-theme
```

## Useful refs

https://github.com/cypher/dotfiles
