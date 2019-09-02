//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

import * as React from 'react';
import { Store } from 'redux';

import { AccountInfoCallback, AuthenticationState, IAccountInfo } from './Interfaces';
import { MsalAuthProvider } from './MsalAuthProvider';

type UnauthenticatedFunction = (login: LoginFunction) => JSX.Element;
type AuthenticatedFunction = (logout: LogoutFunction) => JSX.Element;
type LoginFunction = () => void;
type LogoutFunction = () => void;

export interface IAzureADFunctionProps {
  login: LoginFunction;
  logout: LogoutFunction;
  authenticationState: AuthenticationState;
  accountInfo: IAccountInfo | null;
}

export interface IAzureADProps {
  provider: MsalAuthProvider;
  unauthenticatedFunction?: UnauthenticatedFunction;
  authenticatedFunction?: AuthenticatedFunction;
  accountInfoCallback?: AccountInfoCallback;
  reduxStore?: Store;
  forceLogin?: boolean;
}

interface IAzureADState {
  authenticationState: AuthenticationState;
  accountInfo: IAccountInfo | null;
}

class AzureAD extends React.Component<IAzureADProps, IAzureADState> {
  private authProvider: MsalAuthProvider = this.props.provider;

  // tslint:disable-next-line: member-ordering
  public state: Readonly<IAzureADState> = {
    accountInfo: this.authProvider.getAccountInfo(),
    authenticationState: this.authProvider.authenticationState,
  };

  constructor(props: IAzureADProps) {
    super(props);

    this.authProvider.registerAuthenticationStateHandler(this.setAuthenticationState);
    this.authProvider.registerAcountInfoHandler(this.onAccountInfoChanged);

    if (props.reduxStore) {
      this.authProvider.registerReduxStore(props.reduxStore);
    }

    const { authenticationState } = this.state;
    if (authenticationState === AuthenticationState.Authenticated) {
      const accountInfo = this.state.accountInfo;
      if (accountInfo) {
        this.onAccountInfoChanged(accountInfo);
      }
    } else if (authenticationState === AuthenticationState.Unauthenticated) {
      if (props.forceLogin) {
        this.login();
      }
    }
  }

  public componentWillUnmount() {
    this.authProvider.unregisterAuthenticationStateHandler(this.setAuthenticationState);
    this.authProvider.unregisterAccountInfoHandler(this.onAccountInfoChanged);
  }

  public render() {
    const { authenticatedFunction, unauthenticatedFunction, children } = this.props;
    const { authenticationState, accountInfo } = this.state;
    const { login, logout } = this.authProvider;

    // TODO: This should be created with a hook
    const childrenFunctionProps = {
      accountInfo,
      authenticationState,
      login,
      logout,
    };

    switch (authenticationState) {
      case AuthenticationState.Authenticated:
        if (authenticatedFunction) {
          const authFunctionResult = authenticatedFunction(this.logout);

          if (authFunctionResult) {
            // tslint:disable-next-line: no-console
            console.warn(
              'Warning! The authenticatedFunction callback has been deprecated and will be removed in a future release.',
            );
            return authFunctionResult;
          }
        }

        return this.getChildrenOrFunction(children, childrenFunctionProps);
      case AuthenticationState.Unauthenticated:
        if (unauthenticatedFunction) {
          // tslint:disable-next-line: no-console
          console.warn(
            'Warning! The unauthenticatedFunction callback has been deprecated and will be removed in a future release.',
          );
          return unauthenticatedFunction(this.login) || null;
        }

        return this.getChildrenOrFunction(children, childrenFunctionProps);
      default:
        // TODO: This should not be necessary, but it's being called
        return null;
    }
  }

  public setAuthenticationState = (newState: AuthenticationState) => {
    if (newState !== this.state.authenticationState) {
      this.setState({ authenticationState: newState }, () => {
        if (newState === AuthenticationState.Unauthenticated && this.props.forceLogin) {
          this.login();
        }
      });
    }
  };

  public onAccountInfoChanged = (newAccountInfo: IAccountInfo) => {
    const { accountInfoCallback } = this.props;

    this.setState({
      accountInfo: newAccountInfo,
    });

    if (accountInfoCallback) {
      // tslint:disable-next-line: no-console
      console.warn(
        'Warning! The accountInfoCallback callback has been deprecated and will be removed in a future release.',
      );
      accountInfoCallback(newAccountInfo);
    }
  };

  private login = () => {
    this.authProvider.login();
  };

  private logout = () => {
    if (this.state.authenticationState !== AuthenticationState.Authenticated) {
      return;
    }

    this.authProvider.logout();
  };

  private getChildrenOrFunction = (children: any, props: IAzureADFunctionProps) => {
    if (children) {
      // tslint:disable-next-line: triple-equals
      if (typeof children == 'function' || false) {
        return (children as (props: IAzureADFunctionProps) => {})(props);
      } else {
        return children;
      }
    } else {
      return null;
    }
  };
}

export { AzureAD };
