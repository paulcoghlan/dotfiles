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

## Useful refs

https://github.com/cypher/dotfiles
