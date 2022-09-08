" NB - VimR config is in ~/.config/nvim/init.vim, so setup symbolic link with
" ln -s ~/.vimrc ~/.config/nvim/init.vim

scriptencoding utf-8
set encoding=utf-8

" Copy/paste to OSX
set clipboard=unnamed

" Set directory for ripgrep search
cd $NOTES

set listchars=tab:\|\ 

" Enable ripgrep
if executable("rg")
    set grepprg=rg\ --vimgrep\ --no-heading
    set grepformat=%f:%l:%c:%m,%f:%l:%m
endif

" Automatically enter quick list after grep
augroup myvimrc
    autocmd!
    autocmd QuickFixCmdPost [^l]* cwindow 50
    autocmd QuickFixCmdPost l*    lwindow
augroup END

" Quicklist nav keys - ctrl-J/K 
map <C-j> :cn<CR><CR>
map <C-k> :cp<CR><CR>
map <C-g> :silent :grep 
map <C-m> :wincmd w<CR>

" https://hackernoon.com/learning-vim-what-i-wish-i-knew-b5dca186bef7
set number
set relativenumber

" https://github.com/mcantor/no_plugins/blob/master/no_plugins.vim
" NOW WE CAN:
" - Hit tab to :find by partial match
" - Use * to make it fuzzy
set path+=**
set wildmenu


" Statusline
" http://vimdoc.sourceforge.net/htmldoc/options.html#'statusline'
" https://learnvimscriptthehardway.stevelosh.com/chapters/17.html
let g:currentmode={
\ 'n'  : 'N ',
\ 'no' : 'N·Operator Pending ',
\ 'v'  : 'V ',
    \ 'V'  : 'V·Line ',
    \ '^V' : 'V·Block ',
    \ 's'  : 'Select ',
    \ 'S'  : 'S·Line ',
    \ '^S' : 'S·Block ',
    \ 'i'  : 'I ',
    \ 'R'  : 'R ',
    \ 'Rv' : 'V·Replace ',
    \ 'c'  : 'Command ',
    \ 'cv' : 'Vim Ex ',
    \ 'ce' : 'Ex ',
    \ 'r'  : 'Prompt ',
    \ 'rm' : 'More ',
    \ 'r?' : 'Confirm ',
    \ '!'  : 'Shell ',
    \ 't'  : 'Terminal '
    \}

" Find out current buffer's size and output it.
function! FileSize()
  let bytes = getfsize(expand('%:p'))
  if (bytes >= 1024)
    let kbytes = bytes / 1024
  endif
  if (exists('kbytes') && kbytes >= 1000)
    let mbytes = kbytes / 1000
  endif

  if bytes <= 0
    return '0'
  endif

  if (exists('mbytes'))
    return mbytes . 'MB'
  elseif (exists('kbytes'))
    return kbytes . 'KB'
  else
    return bytes . 'B'
  endif
endfunction

" Git
function! GitBranch()
  return system("git rev-parse --abbrev-ref HEAD 2>/dev/null | tr -d '\n'")
endfunction

function! StatuslineGit()
  let l:branchname = GitBranch()
  return strlen(l:branchname) > 0?'  '.l:branchname.' ':''
endfunction

" Keep status line on permanently
set laststatus=2

set statusline=
set statusline+=%{StatuslineGit()}            " Git branch
set statusline+=%n:%8*\ %<%F\ %r\ %m\ %w\     " Buffer, File+path
set statusline+=%=                            " Left/right separator
set statusline+=\ %y                          " Type of file
set statusline+=\ %{&fileencoding?&fileencoding:&encoding} " Encoding
set statusline+=\[%{&fileformat}\]            " Format
set statusline+=%8*\ size:%{FileSize()}       " File size
set statusline+=\ char:%03b(0x%02B)\ col:%2c\ ln:%l/%L(%p%%) " Char/Position

colorscheme evening

set mouse=a
