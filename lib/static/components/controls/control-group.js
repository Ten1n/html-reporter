'use strict';

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import ControlButton from './button';

export default class ControlGroup extends Component {
    static propTypes = {
        options: PropTypes.array.isRequired
    }

    render() {
        const {options} = this.props;

        return (
            <div className={'control-group'}>
                {
                    options.map((option) => {
                        return (<ControlButton label={option.label} handler={option.handler} isActive={option.isActive} extraClasses={['control-group__item']}/>);
                    })
                }
            </div>
        );
    }
}
