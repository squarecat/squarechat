import { Component, h } from 'preact';
import {
  desktopClosedWrapperStyleChat,
  desktopTitleStyle,
  desktopWrapperStyle,
  mobileClosedWrapperStyle,
  mobileOpenWrapperStyle
} from './style';

import ArrowIcon from './arrow-icon';
import ChatFloatingButton from './chat-floating-button';
import ChatFrame from './chat-frame';
import ChatTitleMsg from './chat-title-msg';

export default class Widget extends Component {
  constructor(props) {
    super();
    this.state.hideButton = props.conf.hideButton;
    this.state.isChatOpen = false;
    this.state.pristine = true;
    this.state.wasChatOpened = false;
    this.state.unreadCount = props.unreadCount || 0;
  }

  componentDidMount() {
    this.interval = setInterval(() => this.unread(), 10000);
    // don't call this on load ever
    window.intergram = {
      open: () => {
        this.onClick();
      },
      hide: () => {
        this.setState({ ...this.state, hideButton: true });
      }
    };
  }

  unread() {
    const { userId } = window.intergramOnOpen || {};
    const { pristine, unreadCount, isChatOpen } = this.state;
    // if the chat is not open but has been used before
    // then check for unread messages
    if (userId && !isChatOpen && !pristine) {
      requestUnreads(userId, (unreads) => {
        this.setState({
          ...this.state,
          unreadCount: unreads
        });
      });
    }
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.isChatOpen && this.props.isChatOpen) {
      this.setState({
        unreadCount: 0
      });
    }
  }

  render({ conf, isMobile }, { isChatOpen, pristine, hideButton }) {
    const wrapperWidth = { width: conf.desktopWidth };
    const desktopHeight =
      window.innerHeight - 100 < conf.desktopHeight
        ? window.innerHeight - 90
        : conf.desktopHeight;
    const wrapperHeight = { height: desktopHeight };

    let wrapperStyle;
    if (!isChatOpen && (isMobile || conf.alwaysUseFloatingButton)) {
      wrapperStyle = { ...mobileClosedWrapperStyle }; // closed mobile floating button
    } else if (!isMobile) {
      wrapperStyle =
        conf.closedStyle === 'chat' || isChatOpen || this.state.wasChatOpened
          ? isChatOpen
            ? { ...desktopWrapperStyle, ...wrapperWidth } // desktop mode, button style
            : { ...desktopWrapperStyle }
          : { ...desktopClosedWrapperStyleChat }; // desktop mode, chat style
    } else {
      wrapperStyle = mobileOpenWrapperStyle; // open mobile wrapper should have no border
    }
    let chatHeight = isMobile ? '100%' : desktopHeight;
    if (!isChatOpen) {
      chatHeight = 0;
    }

    wrapperStyle = {
      ...wrapperStyle,
      pointerEvents: hideButton && !isChatOpen ? 'none' : 'all'
    };

    return (
      <div style={wrapperStyle}>
        <div
          style={{
            background: conf.mainColor,
            ...desktopTitleStyle,
            display: isChatOpen ? 'none' : 'flex',
            visibility: hideButton ? 'hidden' : 'visible'
          }}
          onClick={this.onClick}
        >
          {this.state.unreadCount > 0 ? (
            <span
              style={{
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '15px',
                height: '15px',
                background: 'red',
                borderRadius: '50%',
                lineHeight: '10px',
                fontSize: '10px',
                fontWeight: 'bold'
              }}
            >
              {this.state.unreadCount}
            </span>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 32"
              width="16"
              height="16"
              fill="none"
              stroke="currentcolor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
            >
              <path d="M2 4 L30 4 30 22 16 22 8 29 8 22 2 22 Z" />
            </svg>
          )}

          {isChatOpen ? conf.titleOpen : conf.titleClosed}
        </div>

        {/* Chat IFrame */}
        <div
          style={{
            position: 'relative',
            transition:
              'opacity 200ms 100ms ease-in-out, transform 200ms 100ms ease-in-out',
            height: chatHeight,
            transform: `translateY(${isChatOpen ? 0 : 10}px)`,
            opacity: isChatOpen ? 1 : 0,
            borderRadius: '8px',
            boxShadow: '0 12px 20px 0 rgba(0,0,0,.15)',
            backgroundColor: 'white'
          }}
        >
          <a
            onClick={this.onClick}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundImage:
                'url(data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOSIgaGVpZ2h0PSI4IiB2aWV3Qm94PSIwIDAgOSA4IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIHN0cm9rZS13aWR0aD0iMS40IiBzdHJva2U9IiNGRkYiIGZpbGw9Im5vbmUiIGZpbGwtcnVsZT0iZXZlbm9kZCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNy41MzkuNzIyTC45NjMgNy4yODRNLjk2My43MjJsNi41NzYgNi41NjIiLz48L2c+PC9zdmc+)',
              width: '18px',
              height: '18px',
              backgroundSize: '9px',
              backgroundRepeat: 'no-repeat',
              backgroundColor: 'rgba(0,0,0,0.1)',
              borderRadius: '3px',
              backgroundPosition: 'center',
              cursor: 'pointer'
            }}
          />
          {pristine ? null : <ChatFrame {...this.props} />}
        </div>
      </div>
    );
  }

  onClick = () => {
    let stateData = {
      pristine: false,
      isChatOpen: !this.state.isChatOpen
    };
    if (!this.state.isChatOpen && !this.state.wasChatOpened) {
      stateData.wasChatOpened = true;
    }
    this.setState(stateData);
  };
}

function requestUnreads(userId, cb) {
  const server = window.intergramServer || 'https://www.intergram.xyz';
  const request = new XMLHttpRequest();
  const url = `${server}/unreads?userId=${userId}`;
  request.open('POST', url);
  request.onload = () => cb(request.responseText);
  request.send();
}
