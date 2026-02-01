eval $(/opt/homebrew/bin/brew shellenv)

export NOTES=$HOME/notes
export GOPATH=$HOME/go
export PATH=.:$GOPATH/bin:$PATH
export PNPM_HOME=$HOME/Library/pnpm
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

export USE_GKE_GCLOUD_AUTH_PLUGIN=True

alias config='/usr/bin/git --git-dir=$HOME/.cfg/ --work-tree=$HOME'

alias gd='git diff'
alias gg='git log --oneline --abbrev-commit --all --graph --decorate --color'
alias ggl='git log --oneline --abbrev-commit --all --graph --decorate --color --stat'
alias gs='git status'
alias gph='git push'
alias gpl='git pull --rebase'
alias gc='git commit -m'
alias ga='git add'
alias gap='git add -p'

alias k=kubectl

function gr() { git rebase -i HEAD~$1; }

function docker-rm() { dockrr rm -f $(docker ps -q -a) }

# Prevent history being lost from multiple concurrent sessions
setopt APPEND_HISTORY

# Added by OrbStack: command-line tools and integration
source ~/.orbstack/shell/init.zsh 2>/dev/null || :


