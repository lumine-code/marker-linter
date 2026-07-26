# scrollmap-linter

Show linter messages on the scrollbar.

A layer package for [scrollmap](https://github.com/lumine-code/scrollmap) that renders diagnostics reported through the [linter](https://github.com/lumine-code/linter) package.

## Features

- **Message markers**: shows linter errors, warnings and infos as scrollbar markers.
- **Severity colors**: markers are colored by message severity via theme colors.
- **Range merging**: adjacent messages of the same severity are merged into a single marker.
- **Threshold**: optionally hide all markers when the message count gets too large.

## Installation

To install `scrollmap-linter` search for _scrollmap-linter_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/scrollmap-linter`.

## Customization

The style can be adjusted in the `styles.less` file, e.g. recolor markers of a given severity:

```less
.scrollmap .marker.marker-linter {
  &.warning {
    background-color: var(--text-color-modified);
  }
}
```

## Services

- **[scrollmap.layer](https://lumine-code.github.io/docs.html#services/scrollmap.layer)** (`1.0.0`): provided to register the `linter` marker layer rendered on the editor scrollbar.
- **[linter.ui](https://lumine-code.github.io/docs.html#services/linter.ui)** (`1.0.0`): provided to receive linter message patches from the linter package.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
