'use strict';
import React, {Component, Fragment} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import * as actions from '../../modules/actions';
import ControlButton from './button';
import ControlGroup from './control-group';
import ViewSelect from './view-select';
import BaseHostInput from './base-host';

class ControlButtons extends Component {
    render() {
        const {view, actions} = this.props;

        return (
            <Fragment>
                <ViewSelect options = {[
                    {value: 'all', text: 'Show all'},
                    {value: 'failed', text: 'Show only failed'}
                ]}/>
                <ControlGroup options = {[
                    {label: 'Expand all', isActive: view.expand === 'all', handler: actions.expandAll},
                    {label: 'Collapse all', isActive: view.expand === 'none', handler: actions.collapseAll},
                    {label: 'Expand errors', isActive: view.expand === 'errors', handler: actions.expandErrors},
                    {label: 'Expand retries', isActive: view.expand === 'retries', handler: actions.expandRetries}
                ]}/>
                <ControlButton
                    label="Show skipped"
                    isActive={view.showSkipped}
                    handler={actions.toggleSkipped}
                />
                <ControlButton
                    label="Show only diff"
                    isActive={view.showOnlyDiff}
                    handler={actions.toggleOnlyDiff}
                />
                <ControlButton
                    label="Scale images"
                    isActive={view.scaleImages}
                    handler={actions.toggleScaleImages}
                />
                <BaseHostInput/>
            </Fragment>
        );
    }
}

export default connect(
    (state) => ({view: state.view}),
    (dispatch) => ({actions: bindActionCreators(actions, dispatch)})
)(ControlButtons);
